from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.models import Asset, Transaction, RawDailyPrice
from datetime import date


def test_stress_test_no_yfinance_call(db_session, client):
    """The /api/stress-test endpoint must not call yfinance.
    DB is source of truth."""
    a = Asset(symbol="GUARD1", source="US", name="Guard 1")
    db_session.add(a)
    db_session.commit()
    db_session.add(Transaction(asset_id=a.id, type="BUY", quantity=10, price=100.0))
    db_session.add(RawDailyPrice(date=date.today(), ticker="GUARD1", close_price=100.0))
    db_session.commit()

    with patch(
        "app.services.price_service.yf.Ticker",
        side_effect=AssertionError("read path called yfinance"),
    ), patch(
        "app.services.price_service.fdr.DataReader",
        side_effect=AssertionError("read path called fdr"),
    ), patch(
        "app.services.stress_service.yf.download",
        side_effect=AssertionError("stress service called yfinance"),
    ):
        response = client.get("/api/stress-test")

    # Endpoint may return data or empty list, but MUST NOT raise.
    assert response.status_code == 200


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
