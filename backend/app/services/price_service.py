import yfinance as yf
import FinanceDataReader as fdr
from datetime import datetime, timedelta
import pandas as pd

class PriceService:
    @staticmethod
    def get_current_price(symbol: str, source: str = "US") -> float:
        """
        Fetches the latest closing price for a given symbol.
        source: "US" for Yahoo Finance, "KR" for FinanceDataReader
        """
        try:
            if source == "US":
                ticker = yf.Ticker(symbol)
                # Try to get live price first, fallback to history
                data = ticker.history(period="1d")
                if not data.empty:
                    return float(data['Close'].iloc[-1])
                
            elif source == "KR":
                # KR symbols are usually 6-digit codes
                df = fdr.DataReader(symbol, (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'))
                if not df.empty:
                    return float(df['Close'].iloc[-1])
            
            return 0.0
        except Exception as e:
            print(f"Error fetching price for {symbol}: {e}")
            return 0.0

    @staticmethod
    def get_historical_prices(symbol: str, start_date: str, end_date: str, source: str = "US"):
        """
        Fetches historical daily closing prices.
        """
        try:
            if source == "US":
                df = yf.download(symbol, start=start_date, end=end_date)
                return df['Close']
            elif source == "KR":
                df = fdr.DataReader(symbol, start_date, end_date)
                return df['Close']
        except Exception as e:
            print(f"Error fetching history for {symbol}: {e}")
            return pd.Series()
