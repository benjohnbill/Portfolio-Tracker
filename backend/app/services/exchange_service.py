import FinanceDataReader as fdr
from datetime import datetime, timedelta
import pandas as pd
import time

_fx_history_cache = {}
_fx_current_cache = {}

class ExchangeService:
    @staticmethod
    def get_usd_krw_history(start_date: str, end_date: str):
        """
        Fetches historical USD/KRW exchange rates.
        Uses a 1-hour in-memory cache to prevent blocking API responses on page loads.
        """
        key = f"{start_date}_{end_date}"
        if key in _fx_history_cache and time.time() - _fx_history_cache[key].get("time", 0) < 3600:
            return _fx_history_cache[key]["val"]

        try:
            df = fdr.DataReader('USD/KRW', start_date, end_date)
            if not df.empty:
                result = df['Close']
                _fx_history_cache[key] = {"val": result, "time": time.time()}
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
