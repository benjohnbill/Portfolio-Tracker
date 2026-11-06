import yfinance as yf
import FinanceDataReader as fdr
from datetime import datetime, timedelta
import pandas as pd
from sqlalchemy.orm import Session

from ..models import RawDailyPrice
from .day_scoped_cache import DayScopedCache

# Keyed by (symbol, source). The cache drops every entry on day rollover.
_PRICE_CACHE: DayScopedCache[float] = DayScopedCache()


class PriceService:
    @staticmethod
    def get_current_price(db: Session, symbol: str, source: str = "US") -> float:
        """
        Returns the latest close price for `symbol` from RawDailyPrice.
        DB is source of truth — populated by the daily cron pipeline.
        Returns 0.0 when no row exists for the symbol.
        Caller decides how to handle 0.0 (e.g. trigger backfill).
        """
        cache_key = (symbol, source)
        cached = _PRICE_CACHE.get(cache_key)
        if cached is not None:
            return cached

        row = (
            db.query(RawDailyPrice)
            .filter(RawDailyPrice.ticker == symbol)
            .order_by(RawDailyPrice.date.desc())
            .first()
        )
        if row is None:
            return 0.0

        price = float(row.close_price)
        _PRICE_CACHE.set(cache_key, price)
        return price

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
