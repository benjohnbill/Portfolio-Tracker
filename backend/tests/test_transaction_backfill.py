from unittest.mock import patch
import pandas as pd
from app.models import Asset, RawDailyPrice
from app.services.ingestion_service import PriceIngestionService


def test_backfill_single_symbol_writes_history(db_session):
    asset = Asset(symbol="NEWSYM", source="US", name="New Symbol")
    db_session.add(asset)
    db_session.commit()

    # Mock yfinance to return 5 days of fake history.
    fake_hist = pd.Series(
        [100.0, 101.0, 99.0, 102.0, 103.0],
        index=pd.date_range(end="2026-05-14", periods=5),
        name="Close",
    )
    with patch(
        "app.services.price_service.PriceService.get_historical_prices",
        return_value=fake_hist,
    ):
        PriceIngestionService.backfill_single_symbol(db_session, asset)

    rows = db_session.query(RawDailyPrice).filter(RawDailyPrice.ticker == "NEWSYM").all()
    assert len(rows) == 5
    assert max(r.close_price for r in rows) == 103.0


def test_create_transaction_backfills_new_asset(db_session, client):
    fake_hist = pd.Series(
        [200.0, 210.0, 220.0],
        index=pd.date_range(end="2026-05-14", periods=3),
        name="Close",
    )
    with patch(
        "app.services.price_service.PriceService.get_historical_prices",
        return_value=fake_hist,
    ), patch(
        "app.services.price_service.PriceService.get_current_price",
        return_value=220.0,
    ):
        response = client.post("/api/transactions", json={
            "symbol": "FRESHASSET",
            "type": "BUY",
            "quantity": 1,
            "date": "2026-05-14",
        })

    assert response.status_code in (200, 201)
    rows = db_session.query(RawDailyPrice).filter(RawDailyPrice.ticker == "FRESHASSET").all()
    assert len(rows) == 3  # backfill ran
