from unittest.mock import patch, MagicMock
import pandas as pd
from app.services.price_service import PriceService, _PRICE_CACHE


def test_get_current_price_caches_within_day():
    _PRICE_CACHE.clear()
    fake_data = pd.DataFrame({"Close": [123.45]})
    fake_ticker = MagicMock()
    fake_ticker.history.return_value = fake_data

    with patch("app.services.price_service.yf.Ticker", return_value=fake_ticker) as mock_ticker:
        first = PriceService.get_current_price("FAKE", "US")
        second = PriceService.get_current_price("FAKE", "US")

    assert first == 123.45
    assert second == 123.45
    assert mock_ticker.call_count == 1  # second call must hit cache
