import yfinance as yf
import FinanceDataReader as fdr
from datetime import datetime, timedelta, date
from typing import Tuple, Dict
import pandas as pd

# Module-level cache for the current backend process. Keyed by
# (symbol, source, ISO date). Day rollover invalidates automatically
# because the date component changes; no TTL mechanism needed.
_PRICE_CACHE: Dict[Tuple[str, str, str], float] = {}


class PriceService:
    @staticmethod
    def get_current_price(symbol: str, source: str = "US") -> float:
        """
        Fetches the latest closing price for a given symbol.
        source: "US" for Yahoo Finance, "KR" for FinanceDataReader.
        Same-day calls reuse a process-local cache.
        """
        cache_key = (symbol, source, date.today().isoformat())
        if cache_key in _PRICE_CACHE:
            return _PRICE_CACHE[cache_key]

        try:
            if source == "US":
                ticker = yf.Ticker(symbol)
                data = ticker.history(period="1d")
                if not data.empty:
                    price = float(data['Close'].iloc[-1])
                    _PRICE_CACHE[cache_key] = price
                    return price

            elif source == "KR":
                df = fdr.DataReader(symbol, (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'))
                if not df.empty:
                    price = float(df['Close'].iloc[-1])
                    _PRICE_CACHE[cache_key] = price
                    return price

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
                return df['Close'].squeeze()
            elif source == "KR":
                df = fdr.DataReader(symbol, start_date, end_date)
                return df['Close'].squeeze()
        except Exception as e:
            print(f"Error fetching history for {symbol}: {e}")
            return pd.Series()

    @staticmethod
    def get_historical_prices_bulk(symbols: list, start_date: str, end_date: str) -> pd.DataFrame:
        """
        Fetches historical daily closing prices for multiple US symbols simultaneously.
        """
        if not symbols:
            return pd.DataFrame()
            
        try:
            df = yf.download(symbols, start=start_date, end=end_date)
            if len(symbols) == 1:
                close_df = pd.DataFrame(df['Close'])
                close_df.columns = symbols
                return close_df
            return df['Close']
        except Exception as e:
            print(f"Error fetching bulk history for {symbols}: {e}")
            return pd.DataFrame()
