from unittest.mock import patch

import pandas as pd
from freezegun import freeze_time

from app.services.day_scoped_cache import DayScopedCache
from app.services.exchange_service import ExchangeService, _FX_HISTORY_CACHE


def test_returns_stored_value_within_the_same_day():
    cache = DayScopedCache()
    with freeze_time("2026-01-01 09:00"):
        cache.set("k", 1.5)
    with freeze_time("2026-01-01 23:59"):
        assert cache.get("k") == 1.5


def test_returns_falsy_value_instead_of_treating_it_as_a_miss():
    cache = DayScopedCache()
    cache.set("k", 0.0)
    assert cache.get("k") == 0.0


def test_drops_every_entry_when_the_day_changes():
    cache = DayScopedCache()
    with freeze_time("2026-01-01"):
        cache.set("a", 1.0)
        cache.set("b", 2.0)
        assert len(cache) == 2
    with freeze_time("2026-01-02"):
        assert cache.get("a") is None
        assert len(cache) == 0


def test_set_after_rollover_does_not_keep_previous_day_entries():
    cache = DayScopedCache()
    with freeze_time("2026-01-01"):
        cache.set("old", 1.0)
    with freeze_time("2026-01-02"):
        cache.set("new", 2.0)
        assert cache.get("old") is None
        assert len(cache) == 1


def test_fx_history_cache_holds_only_today_after_rollover():
    _FX_HISTORY_CACHE.clear()
    fake_df = pd.DataFrame(
        {"Close": [1300.0]}, index=pd.to_datetime(["2026-01-01"])
    )

    with patch(
        "app.services.exchange_service.fdr.DataReader", return_value=fake_df
    ) as mock_reader:
        with freeze_time("2026-01-01"):
            ExchangeService.get_usd_krw_history("2026-01-01", "2026-01-01")
        with freeze_time("2026-01-02"):
            ExchangeService.get_usd_krw_history("2026-01-01", "2026-01-01")
            assert len(_FX_HISTORY_CACHE) == 1

    assert mock_reader.call_count == 2  # the new day must fetch again
