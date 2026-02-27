import FinanceDataReader as fdr
from datetime import datetime, timedelta
import pandas as pd

class ExchangeService:
    @staticmethod
    def get_usd_krw_history(start_date: str, end_date: str):
        """
        Fetches historical USD/KRW exchange rates.
        """
        try:
            # FinanceDataReader can fetch exchange rates using 'USD/KRW'
            df = fdr.DataReader('USD/KRW', start_date, end_date)
            if not df.empty:
                return df['Close']
            return pd.Series()
        except Exception as e:
            print(f"Error fetching exchange rates: {e}")
            return pd.Series()

    @staticmethod
    def get_current_rate():
        """
        Fetches the latest USD/KRW exchange rate.
        """
        try:
            # Get last 7 days to ensure we get the latest trading day
            start_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
            df = fdr.DataReader('USD/KRW', start_date)
            if not df.empty:
                return float(df['Close'].iloc[-1])
            return 1400.0 # Emergency fallback
        except Exception as e:
            print(f"Error fetching current exchange rate: {e}")
            return 1400.0
