"""Track A — algo_service NDX rotation signals fire after asset migration.

Before the T2 migration, Asset id=1 had symbol="QQQ", so the check
`"KODEX_1X" in holdings` at algo_service.py:252 always evaluated False
and the Growth Mode signal was silently suppressed.  After migration the
symbol is "KODEX_1X" and the check matches.

These tests verify that:
- Growth Mode fires when holdings contain KODEX_1X and NDX > 250MA.
- Safety Mode fires when holdings contain TIGER_2X and NDX < 250MA.

Holdings are seeded via Asset + Transaction rows (the path that
get_holdings(db) actually traverses).  QuantService calls and
_get_ticker_signals are stubbed to control the NDX 250MA branch without
needing real price history.
"""
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from sqlalchemy.orm import Session

from app.models import AccountSilo, AccountType, Asset, Transaction
from app.services.algo_service import AlgoService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_holding(db: Session, symbol: str, quantity: float = 10.0) -> None:
    """Seed one Asset + one BUY Transaction so get_holdings() sees the symbol."""
    asset = Asset(
        symbol=symbol,
        code=symbol,
        name=f"Test {symbol}",
        source="KR",
        account_type=AccountType.ISA,
        account_silo=AccountSilo.ISA_ETF,
    )
    db.add(asset)
    db.flush()  # populate asset.id before foreign key

    tx = Transaction(
        date=datetime.now(timezone.utc),
        asset_id=asset.id,
        type="BUY",
        quantity=quantity,
        price=10_000.0,
        total_amount=quantity * 10_000.0,
        account_type=AccountType.ISA,
    )
    db.add(tx)
    db.commit()


_NDX_ABOVE_MA = {
    "current_price": 20_000.0,
    "ma_250": 18_000.0,
    "is_above_ma": True,
}

_NDX_BELOW_MA = {
    "current_price": 17_000.0,
    "ma_250": 18_000.0,
    "is_above_ma": False,
}

# Neutral GLDM/TLT signals — price == ma so no GLDM/TLT rules trigger.
_NEUTRAL_TICKER = {"price": 100.0, "ma_250": 100.0, "rsi": 50.0}

# Neutral MSTR signal — z_score=0, mnav=1 → no MSTR rules trigger.
_NEUTRAL_MSTR = {"z_score": 0.0, "current_mnav_ratio": 1.0}

# Neutral VXN signal (not used in NDX rules, but get_action_report reads it).
_NEUTRAL_VXN = {"vxn": 20.0}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_growth_mode_fires_when_holding_kodex_1x_and_ndx_above_250ma(
    db_session: Session,
):
    """Growth Mode signal (SELL KODEX_1X -> BUY TIGER_2X) fires when:
    - holdings contain KODEX_1X  (the post-migration symbol)
    - NDX is above its 250-day MA
    """
    _seed_holding(db_session, "KODEX_1X")

    with (
        patch(
            "app.services.algo_service.QuantService.get_ndx_status",
            return_value=_NDX_ABOVE_MA,
        ),
        patch(
            "app.services.algo_service.QuantService.get_mstr_signal",
            return_value=_NEUTRAL_MSTR,
        ),
        patch(
            "app.services.algo_service.QuantService.get_vxn_signal",
            return_value=_NEUTRAL_VXN,
        ),
        patch.object(
            AlgoService,
            "_get_ticker_signals",
            return_value=_NEUTRAL_TICKER,
        ),
    ):
        result = AlgoService.get_action_report(db_session)

    actions = result["actions"]
    assert any(
        "KODEX_1X" in a["action"] and "TIGER_2X" in a["action"]
        for a in actions
    ), (
        "Expected a Growth Mode action containing both 'KODEX_1X' and 'TIGER_2X'. "
        f"Actual actions: {[a['action'] for a in actions]}"
    )


def test_safety_mode_fires_when_holding_tiger_2x_and_ndx_below_250ma(
    db_session: Session,
):
    """Safety Mode signal (SELL TIGER_2X -> BUY KODEX_1X) fires when:
    - holdings contain TIGER_2X
    - NDX is below its 250-day MA
    """
    _seed_holding(db_session, "TIGER_2X")

    with (
        patch(
            "app.services.algo_service.QuantService.get_ndx_status",
            return_value=_NDX_BELOW_MA,
        ),
        patch(
            "app.services.algo_service.QuantService.get_mstr_signal",
            return_value=_NEUTRAL_MSTR,
        ),
        patch(
            "app.services.algo_service.QuantService.get_vxn_signal",
            return_value=_NEUTRAL_VXN,
        ),
        patch.object(
            AlgoService,
            "_get_ticker_signals",
            return_value=_NEUTRAL_TICKER,
        ),
    ):
        result = AlgoService.get_action_report(db_session)

    actions = result["actions"]
    assert any(
        "TIGER_2X" in a["action"] and "KODEX_1X" in a["action"]
        for a in actions
    ), (
        "Expected a Safety Mode action containing both 'TIGER_2X' and 'KODEX_1X'. "
        f"Actual actions: {[a['action'] for a in actions]}"
    )
