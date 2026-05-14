from datetime import date, timedelta
from unittest.mock import patch
import pandas as pd
from app.models import RawDailyPrice
from app.services.price_service import PriceService, _PRICE_CACHE


def test_get_current_price_reads_from_raw_daily_price(db_session):
    _PRICE_CACHE.clear()
    today = date.today()
    db_session.add_all([
        RawDailyPrice(date=today - timedelta(days=2), ticker="AAA", close_price=100.0),
        RawDailyPrice(date=today - timedelta(days=1), ticker="AAA", close_price=110.0),
        RawDailyPrice(date=today, ticker="AAA", close_price=120.0),
    ])
    db_session.commit()

    # Patch yfinance to raise — if get_current_price calls it, test fails.
    with patch(
        "app.services.price_service.yf.Ticker",
        side_effect=AssertionError("get_current_price must not call yfinance"),
    ):
        price = PriceService.get_current_price(db_session, "AAA", "US")

    assert price == 120.0  # latest row


def test_get_current_price_returns_zero_for_unknown_symbol(db_session):
    _PRICE_CACHE.clear()
    price = PriceService.get_current_price(db_session, "UNKNOWN_TICKER", "US")
    assert price == 0.0


def test_get_current_price_uses_cache_on_second_call(db_session):
    _PRICE_CACHE.clear()
    db_session.add(RawDailyPrice(date=date.today(), ticker="BBB", close_price=50.0))
    db_session.commit()

    first = PriceService.get_current_price(db_session, "BBB", "US")
    # Mutate DB after the first call. Cache should still return the old value.
    db_session.query(RawDailyPrice).filter(RawDailyPrice.ticker == "BBB").update({"close_price": 999.0})
    db_session.commit()
    second = PriceService.get_current_price(db_session, "BBB", "US")

    assert first == 50.0
    assert second == 50.0  # cached
