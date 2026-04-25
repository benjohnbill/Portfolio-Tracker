"""Track A — same-day swap is cashflow-neutral.

When a BUY of one asset and a SELL of another asset occur on the same date
with no DEPOSIT or WITHDRAW, the day's net_cashflow is 0 and the day's
performance_daily_return is driven only by holdings price movement. This
matches the next-Friday rotation scenario where KODEX_1X is partially
sold to fund a TIGER_2X buy.
"""
from datetime import date, datetime, time, timedelta, timezone

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.models import (
    Asset, AccountType, AccountSilo,
    Transaction, RawDailyPrice,
    PortfolioPerformanceSnapshot,
)
from app.services.exchange_service import ExchangeService
from app.services.portfolio_service import PortfolioService


import pandas as pd

ANCHOR_DATE = date(2026, 4, 25)


def _stub_fx(monkeypatch) -> None:
    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda _start, _end: pd.Series(dtype=float)),
    )


def _seed_anchor_row(session: Session) -> None:
    """Seed the manual-anchor row so anchor-aware behavior triggers."""
    session.execute(
        sa.text("""
            INSERT INTO portfolio_performance_snapshots
                (date, performance_value, benchmark_value, daily_return, alpha,
                 coverage_start_date, coverage_status, source_version, updated_at)
            SELECT :anchor_date, 100.0, 100.0, 0.0, 0.0,
                   :anchor_date, 'ready', 'manual-anchor-v1', :now
            WHERE NOT EXISTS (
                SELECT 1 FROM portfolio_performance_snapshots WHERE date = :anchor_date
            )
        """),
        {"anchor_date": ANCHOR_DATE, "now": datetime.now(timezone.utc)},
    )
    session.commit()


def _seed_asset(db: Session, *, symbol, ticker, source="KR"):
    a = Asset(
        symbol=symbol, code=ticker, name=f"{symbol} test asset",
        source=source,
        account_type=AccountType.ISA,
        account_silo=AccountSilo.ISA_ETF,
    )
    db.add(a)
    db.flush()
    return a


def test_same_day_swap_with_zero_net_cashflow_is_price_only(
    db_session: Session, monkeypatch
):
    """SELL X + BUY Y on the same day with equal total_amount produces
    net_cashflow = 0 (or None, since no DEPOSIT/WITHDRAW tracked); and
    performance_daily_return reflects only the holdings' price movement
    that day, not the swap itself.

    Setup:
      - Anchor row on ANCHOR_DATE (2026-04-25), performance_value=100.
      - a1 (KODEX_1X_TEST): 100 shares bought on ANCHOR_DATE at 10 000 KRW each.
      - swap_date = ANCHOR_DATE + 1 day:
          SELL 50 shares of a1 at 10 000 (total 500 000)
          BUY  100 shares of a2 at  5 000 (total 500 000)   <- net cashflow 0
      - Prices on both dates seeded to be identical (no price movement).

    Expected:
      - swap day appears in history.
      - net_cashflow for the swap day is either 0 or None (no external cash moved).
      - |performance_daily_return| < 1e-6 (flat prices, flat return).
    """
    _stub_fx(monkeypatch)
    _seed_anchor_row(db_session)

    swap_date = ANCHOR_DATE + timedelta(days=1)

    a1 = _seed_asset(db_session, symbol="KODEX_1X_TEST", ticker="TEST_1X")
    a2 = _seed_asset(db_session, symbol="TIGER_2X_TEST", ticker="TEST_2X")

    # Prior BUY on anchor day: 100 shares at 10 000 KRW.
    db_session.add(Transaction(
        date=datetime.combine(ANCHOR_DATE, time.min),
        asset_id=a1.id,
        type="BUY",
        quantity=100.0,
        price=10000.0,
        total_amount=1_000_000.0,
        account_type=AccountType.ISA,
    ))
    db_session.commit()

    # Same-day swap on swap_date: SELL 50 a1 + BUY 100 a2 (net cashflow 0).
    db_session.add(Transaction(
        date=datetime.combine(swap_date, time.min),
        asset_id=a1.id,
        type="SELL",
        quantity=50.0,
        price=10000.0,
        total_amount=500_000.0,
        account_type=AccountType.ISA,
    ))
    db_session.add(Transaction(
        date=datetime.combine(swap_date, time.min),
        asset_id=a2.id,
        type="BUY",
        quantity=100.0,
        price=5000.0,
        total_amount=500_000.0,
        account_type=AccountType.ISA,
    ))
    db_session.commit()

    # Seed consistent prices on both dates so the price-fallback path
    # returns a stable value and no spurious return appears.
    # SPY must also be seeded: get_equity_curve always appends "SPY" to its
    # price query and slices spy_history with a Timestamp index — if SPY is
    # absent the Series has a RangeIndex and the slice raises TypeError.
    for d in [ANCHOR_DATE, swap_date]:
        db_session.add(RawDailyPrice(date=d, ticker="TEST_1X", close_price=10000.0))
        db_session.add(RawDailyPrice(date=d, ticker="TEST_2X", close_price=5000.0))
        db_session.add(RawDailyPrice(date=d, ticker="SPY", close_price=500.0))
    db_session.commit()

    history = PortfolioService.get_equity_curve(db_session, period="all")
    assert history, "get_equity_curve must return non-empty history"

    swap_day = next(
        (d for d in history if d["date"] == swap_date.isoformat()),
        None,
    )
    assert swap_day is not None, (
        f"swap day {swap_date} must appear in equity curve history"
    )

    # net_cashflow on the swap day should be 0 or None.
    # When no DEPOSIT/WITHDRAW exist, get_equity_curve sets net_cashflow=None
    # (not tracked); when they exist, it would be 0.0 because BUY/SELL do not
    # accumulate net_cashflow.  Both represent "no external cash moved."
    nc = swap_day.get("net_cashflow")
    assert nc in (0, 0.0, None), (
        f"Same-day swap with no DEPOSIT/WITHDRAW must have net_cashflow 0 or None, "
        f"got {nc!r}"
    )

    # With flat prices and no external cashflow, performance_daily_return must be ~0.
    pdr = swap_day.get("performance_daily_return")
    assert pdr is not None, (
        "performance_daily_return must be present after anchor day "
        "(is_at_or_after_anchor path must have fired)"
    )
    assert abs(pdr) < 1e-6, (
        f"With no price movement and zero net cashflow, performance_daily_return "
        f"must be ~0; got {pdr}"
    )
