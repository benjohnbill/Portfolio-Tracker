import FinanceDataReader as fdr
from datetime import datetime, timedelta, date
from typing import Tuple, Dict
import pandas as pd
import time

# Module-level cache for the current backend process. Keyed by
# (start_date, end_date, today's ISO date). Day rollover invalidates
# automatically because the date component changes; no TTL needed.
_FX_HISTORY_CACHE: Dict[Tuple[str, str, str], pd.Series] = {}
_fx_current_cache = {}

class ExchangeService:
    @staticmethod
    def get_usd_krw_history(start_date: str, end_date: str) -> pd.Series:
        """
        Fetches historical USD/KRW exchange rates.
        Same-day calls reuse a process-local cache; day rollover invalidates.
        """
        cache_key = (start_date, end_date, date.today().isoformat())
        if cache_key in _FX_HISTORY_CACHE:
            return _FX_HISTORY_CACHE[cache_key].copy()  # defensive copy

        try:
            df = fdr.DataReader('USD/KRW', start_date, end_date)
            if not df.empty:
                result = df['Close']
                _FX_HISTORY_CACHE[cache_key] = result.copy()
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
