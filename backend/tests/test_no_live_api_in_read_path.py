from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.models import Asset, Transaction, RawDailyPrice
from app.services.cache_service import CacheService
from datetime import date


def test_stress_test_no_yfinance_call(db_session, client):
    """The /api/stress-test endpoint must not call yfinance when scenario
    cache is warm. DB is source of truth."""
    a = Asset(symbol="GUARD1", source="US", name="Guard 1")
    db_session.add(a)
    db_session.commit()
    db_session.add(Transaction(asset_id=a.id, type="BUY", quantity=10, price=100.0, total_amount=1000))
    db_session.add(RawDailyPrice(date=date.today(), ticker="GUARD1", close_price=100.0))
    db_session.commit()

    # Pre-seed the scenario caches so endpoint doesn't need to fetch yfinance.
    # The endpoint maps GUARD1 -> GUARD1 (no proxy), then adds SPY benchmark.
    CacheService.set_cache(
        db_session,
        "stress_closes:2020_COVID:GUARD1,SPY",
        {
            "index": ["2020-02-19", "2020-03-23"],
            "columns": ["GUARD1", "SPY"],
            "data": [[100.0, 300.0], [66.0, 200.0]],
        },
    )
    CacheService.set_cache(
        db_session,
        "stress_closes:2022_BEAR:GUARD1,SPY",
        {
            "index": ["2022-01-03", "2022-10-12"],
            "columns": ["GUARD1", "SPY"],
            "data": [[100.0, 300.0], [80.0, 220.0]],
        },
    )

    yf_download_mock = MagicMock(side_effect=AssertionError("read path called yfinance"))

    with patch(
        "app.services.price_service.yf.Ticker",
        side_effect=AssertionError("read path called yf.Ticker"),
    ), patch(
        "app.services.price_service.fdr.DataReader",
        side_effect=AssertionError("read path called fdr"),
    ), patch(
        "app.services.stress_service.yf.download",
        yf_download_mock,
    ):
        response = client.get("/api/stress-test")

    assert response.status_code == 200
    # Strong guarantee: yfinance was not called at all during this request.
    assert yf_download_mock.call_count == 0, (
        f"stress-test read path called yf.download {yf_download_mock.call_count} times "
        f"despite warm cache"
    )


def test_create_transaction_existing_asset_no_yfinance_call(db_session, client):
    """POST /api/transactions for an existing asset must not call yfinance
    (only new-asset case triggers backfill)."""
    a = Asset(symbol="GUARD2", source="US", name="Guard 2")
    db_session.add(a)
    db_session.add(RawDailyPrice(date=date.today(), ticker="GUARD2", close_price=50.0))
    db_session.commit()

    with patch(
        "app.services.price_service.yf.Ticker",
        side_effect=AssertionError("existing-asset transaction called yfinance"),
    ):
        response = client.post("/api/transactions", json={
            "symbol": "GUARD2",
            "type": "BUY",
            "quantity": 5,
            "date": "2026-05-14",
        })
    assert response.status_code in (200, 201)
