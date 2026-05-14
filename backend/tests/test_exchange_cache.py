from unittest.mock import patch, MagicMock
import pandas as pd
from app.services.exchange_service import ExchangeService, _FX_HISTORY_CACHE


def test_get_usd_krw_history_caches_within_day():
    _FX_HISTORY_CACHE.clear()
    fake_df = pd.DataFrame(
        {"Close": [1300.0, 1310.0]},
        index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
    )

    with patch(
        "app.services.exchange_service.fdr.DataReader", return_value=fake_df
    ) as mock_reader:
        first = ExchangeService.get_usd_krw_history("2026-01-01", "2026-01-02")
        second = ExchangeService.get_usd_krw_history("2026-01-01", "2026-01-02")

    assert list(first) == [1300.0, 1310.0]
    assert list(second) == [1300.0, 1310.0]
    assert mock_reader.call_count == 1  # second call must hit cache


def test_get_usd_krw_history_returns_defensive_copy():
    """Caller mutating the returned Series must not corrupt the cache."""
    _FX_HISTORY_CACHE.clear()
    fake_df = pd.DataFrame(
        {"Close": [1300.0, 1310.0]},
        index=pd.to_datetime(["2026-01-01", "2026-01-02"]),
    )

    with patch(
        "app.services.exchange_service.fdr.DataReader", return_value=fake_df
    ):
        first = ExchangeService.get_usd_krw_history("2026-01-01", "2026-01-02")
        # Mutate the returned series in place
        first.iloc[0] = 9999.0
        second = ExchangeService.get_usd_krw_history("2026-01-01", "2026-01-02")

    assert list(second) == [1300.0, 1310.0], "cache was corrupted by caller mutation"
