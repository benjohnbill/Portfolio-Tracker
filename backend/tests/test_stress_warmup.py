"""Stress cron warmup guard — daily cron must pre-seed scenario close caches.

Without this, the first /api/stress-test request after each Render restart
hits yfinance once per (scenario × proxy set), costing ~5s end-to-end.
warmup_caches walks the current portfolio holdings, maps to scenario proxies,
and calls _fetch_scenario_closes once per scenario so the on-disk cache
is populated before any user request.
"""

from unittest.mock import patch, MagicMock
import pandas as pd

from app.models import Asset, Transaction
from app.services.stress_service import StressService


def _seed_simple_portfolio(db_session):
    asset = Asset(symbol="SPY", code="SPY", name="SPY", source="US")
    db_session.add(asset)
    db_session.flush()
    db_session.add(
        Transaction(
            asset_id=asset.id,
            type="BUY",
            quantity=10.0,
            price=400.0,
            total_amount=4000.0,
        )
    )
    db_session.commit()


def test_warmup_caches_fetches_each_scenario_once(db_session):
    _seed_simple_portfolio(db_session)

    fake_df = pd.DataFrame(
        {"SPY": [100.0, 110.0]},
        index=pd.to_datetime(["2020-02-19", "2020-03-23"]),
    )
    fetch_mock = MagicMock(return_value=fake_df)

    with patch(
        "app.services.stress_service.StressService._fetch_scenario_closes",
        fetch_mock,
    ):
        StressService.warmup_caches(db_session)

    # SCENARIOS has two entries (2020_COVID + 2022_BEAR) — warmup must hit each.
    assert fetch_mock.call_count == len(StressService.SCENARIOS)


def test_warmup_caches_noop_when_no_holdings(db_session):
    fetch_mock = MagicMock()
    with patch(
        "app.services.stress_service.StressService._fetch_scenario_closes",
        fetch_mock,
    ):
        StressService.warmup_caches(db_session)
    assert fetch_mock.call_count == 0
