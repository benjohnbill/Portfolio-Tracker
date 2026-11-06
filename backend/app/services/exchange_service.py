import FinanceDataReader as fdr
from datetime import datetime, timedelta
import pandas as pd
import time

from .day_scoped_cache import DayScopedCache

# Keyed by (start_date, end_date). The cache drops every entry on day rollover.
_FX_HISTORY_CACHE: DayScopedCache[pd.Series] = DayScopedCache()
_fx_current_cache = {}

class ExchangeService:
    @staticmethod
    def get_usd_krw_history(start_date: str, end_date: str) -> pd.Series:
        """
        Fetches historical USD/KRW exchange rates.
        Same-day calls reuse a process-local cache; day rollover invalidates.
        """
        cache_key = (start_date, end_date)
        cached = _FX_HISTORY_CACHE.get(cache_key)
        if cached is not None:
            return cached.copy()  # defensive copy

        try:
            df = fdr.DataReader('USD/KRW', start_date, end_date)
            if not df.empty:
                result = df['Close']
                _FX_HISTORY_CACHE.set(cache_key, result.copy())
                return result
            return pd.Series()
        except Exception as e:
            print(f"Error fetching exchange rates: {e}")
            return pd.Series()

    @staticmethod
    def get_current_rate():
        """
        Fetches the latest USD/KRW exchange rate.
        Uses a 10-minute in-memory cache.
        """
        if "val" in _fx_current_cache and time.time() - _fx_current_cache.get("time", 0) < 600:
            return _fx_current_cache["val"]

        try:
            start_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
            df = fdr.DataReader('USD/KRW', start_date)
            if not df.empty:
                result = float(df['Close'].iloc[-1])
                _fx_current_cache["val"] = result
                _fx_current_cache["time"] = time.time()
                return result
            return 1400.0
        except Exception as e:
            print(f"Error fetching current exchange rate: {e}")
            return 1400.0
