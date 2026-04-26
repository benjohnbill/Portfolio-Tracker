import yfinance as yf
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime, timedelta
from ..models import VXNHistory, MSTRCorporateAction

class QuantService:
    @staticmethod
    def update_vxn_history(db: Session):
        """
        Use yfinance to download historical data for ^VXN (Nasdaq 100 Volatility Index).
        Fetch the last 3 years of daily data.
        Upsert the records (Date, Close) into the vxn_history table.
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=3 * 365)
        
        ticker = "^VXN"
        try:
            # Download data
            df = yf.download(ticker, start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'), progress=False)
            
            if df.empty:
                print("No data found for ^VXN")
                return False
                
            # Handle potential MultiIndex columns in newer yfinance versions
            if isinstance(df.columns, pd.MultiIndex):
                # If there's a multi-index, we want the 'Close' column for '^VXN'
                if ('Close', ticker) in df.columns:
                    close_data = df[('Close', ticker)]
                else:
                    # Fallback to just 'Close' if it's simpler
                    close_data = df['Close']
            else:
                close_data = df['Close']

            # close_data could be a Series or a DataFrame with one column
            if isinstance(close_data, pd.DataFrame):
                close_data = close_data.iloc[:, 0]

            count = 0
            for date_idx, close_val in close_data.items():
                if pd.isna(close_val):
                    continue
                
                # date_idx is a Timestamp
                target_date = date_idx.date()
                val = float(close_val)
                
                stmt = insert(VXNHistory).values(
                    date=target_date,
                    close=val
                )
                
                # Use SQLAlchemy's on_conflict_do_update for PostgreSQL
                stmt = stmt.on_conflict_do_update(
                    index_elements=['date'],
                    set_=dict(close=val)
                )
                
                db.execute(stmt)
                count += 1
                
            db.commit()
            print(f"Successfully updated {count} records for ^VXN history.")
            return True
            
        except Exception as e:
            print(f"Error updating VXN history: {e}")
            db.rollback()
            return False

    @staticmethod
    def get_vxn_signal(db: Session):
        """
        Read all records from vxn_history into a pandas DataFrame.
        Calculate the 50-day Moving Average (50MA) of the 'close' price.
        Calculate the 90th percentile threshold of the 'close' price over the entire 3-year history.
        Identify the latest 'close' price.
        Return a signal dictionary.
        """
        try:
            # Query all records
            query = db.query(VXNHistory).order_by(VXNHistory.date.asc())
            df = pd.read_sql(query.statement, db.bind)
            
            if df.empty:
                print("No VXN history found in database.")
                return None
                
            # Ensure 'close' is float
            df['close'] = df['close'].astype(float)
            
            # Calculate the 50-day Moving Average (50MA)
            df['ma_50'] = df['close'].rolling(window=50).mean()
            
            # Calculate the 90th percentile threshold over the entire 3-year history
            threshold_90 = df['close'].quantile(0.9)
            
            # Identify the latest record
            latest = df.iloc[-1]
            current_vxn = float(latest['close'])
            ma_50 = float(latest['ma_50']) if not pd.isna(latest['ma_50']) else 0.0
            
            return {
                "current_vxn": current_vxn,
                "ma_50": ma_50,
                "threshold_90": float(threshold_90),
                "is_vix_spike": bool(current_vxn > threshold_90)
            }
            
        except Exception as e:
            print(f"Error calculating VXN signal: {e}")
            return None

    @staticmethod
    def seed_mstr_corporate_actions(db: Session):
        """
        Check if mstr_corporate_actions table is empty.
        If empty, seed with dummy historical data.
        """
        count = db.query(MSTRCorporateAction).count()
        if count == 0:
            dummy_data = [
                {"date": "2023-01-01", "btc_holdings": 132500, "outstanding_shares": 11200000},
                {"date": "2023-06-01", "btc_holdings": 152333, "outstanding_shares": 14100000},
                {"date": "2024-01-01", "btc_holdings": 189150, "outstanding_shares": 16800000},
                {"date": "2024-03-01", "btc_holdings": 214246, "outstanding_shares": 17500000},
            ]
            for data in dummy_data:
                action = MSTRCorporateAction(
                    date=datetime.strptime(data["date"], "%Y-%m-%d").date(),
                    btc_holdings=data["btc_holdings"],
                    outstanding_shares=data["outstanding_shares"]
                )
                db.add(action)
            db.commit()
            print("Successfully seeded MSTR corporate actions.")
            return True
        return False

    @staticmethod
    def _build_mstr_dataframe(db: Session):
        """Build full MSTR MNAV/Z-score DataFrame from cached data."""
        from ..models import RawDailyPrice
        mstr_query = db.query(RawDailyPrice).filter(RawDailyPrice.ticker == "MSTR").order_by(RawDailyPrice.date.asc())
        mstr_data = pd.read_sql(mstr_query.statement, db.bind)

        btc_query = db.query(RawDailyPrice).filter(RawDailyPrice.ticker == "BTC-USD").order_by(RawDailyPrice.date.asc())
        btc_data = pd.read_sql(btc_query.statement, db.bind)

        if mstr_data.empty or btc_data.empty:
            return None

        actions_query = db.query(MSTRCorporateAction).order_by(MSTRCorporateAction.date.asc())
        actions_df = pd.read_sql(actions_query.statement, db.bind)

        if actions_df.empty:
            return None

        mstr_df = mstr_data[['date', 'close_price']].copy()
        mstr_df.rename(columns={"close_price": "mstr_close"}, inplace=True)
        mstr_df['date'] = pd.to_datetime(mstr_df['date']).dt.tz_localize(None)

        btc_df = btc_data[['date', 'close_price']].copy()
        btc_df.rename(columns={"close_price": "btc_close"}, inplace=True)
        btc_df['date'] = pd.to_datetime(btc_df['date']).dt.tz_localize(None)

        actions_df['date'] = pd.to_datetime(actions_df['date']).dt.tz_localize(None)

        mstr_df.sort_values('date', inplace=True)
        btc_df.sort_values('date', inplace=True)
        actions_df.sort_values('date', inplace=True)

        df = pd.merge_asof(mstr_df, btc_df, on='date', direction='backward')
        df = pd.merge_asof(df, actions_df, on='date', direction='backward')
        df.dropna(subset=['btc_holdings', 'outstanding_shares'], inplace=True)

        if df.empty:
            return None

        df['mnav'] = (df['btc_close'] * df['btc_holdings']) / df['outstanding_shares']
        df['mnav_ratio'] = df['mstr_close'] / df['mnav']
        df['rolling_mean'] = df['mnav_ratio'].rolling(window=252).mean()
        df['rolling_std'] = df['mnav_ratio'].rolling(window=252).std()
        df['z_score'] = (df['mnav_ratio'] - df['rolling_mean']) / df['rolling_std']

        return df

    @staticmethod
    def get_mstr_signal(db: Session):
        """Calculate MNAV and Z-score for MSTR using cached raw_daily_prices."""
        try:
            df = QuantService._build_mstr_dataframe(db)
            if df is None or df.empty:
                return None

            latest = df.iloc[-1]
            current_mnav = float(latest['mnav'])
            current_mnav_ratio = float(latest['mnav_ratio'])
            rolling_mean = float(latest['rolling_mean'])
            rolling_std = float(latest['rolling_std'])

            z_score = 0.0
            if not pd.isna(rolling_std) and rolling_std != 0:
                z_score = (current_mnav_ratio - rolling_mean) / rolling_std
            elif pd.isna(rolling_std):
                print("Warning: Rolling standard deviation is NaN. Need more data (252 rows minimum).")

            return {
                "current_mnav": current_mnav,
                "current_mnav_ratio": current_mnav_ratio,
                "rolling_mean": rolling_mean if not pd.isna(rolling_mean) else 0.0,
                "rolling_std": rolling_std if not pd.isna(rolling_std) else 0.0,
                "z_score": z_score,
                "last_updated": latest['date'].isoformat() if hasattr(latest['date'], 'isoformat') else str(latest['date'])
            }

        except Exception as e:
            print(f"Error calculating MSTR signal: {e}")
            import traceback
            traceback.print_exc()
            return None

    @staticmethod
    def get_mstr_history(db: Session, period: str = "1y"):
        """Returns historical MSTR Z-score and MNAV ratio series."""
        try:
            df = QuantService._build_mstr_dataframe(db)
            if df is None or df.empty:
                return []

            # Period filtering
            period_days = {"1m": 30, "3m": 90, "6m": 180, "1y": 365}.get(period.lower())
            if period_days:
                cutoff = pd.Timestamp.now() - pd.Timedelta(days=period_days)
                df = df[df['date'] >= cutoff]

            return [
                {
                    "date": row['date'].isoformat() if hasattr(row['date'], 'isoformat') else str(row['date']),
                    "z_score": round(float(row['z_score']), 4) if pd.notna(row['z_score']) else None,
                    "mnav_ratio": round(float(row['mnav_ratio']), 4),
                }
                for _, row in df.iterrows()
            ]
        except Exception as e:
            print(f"Error getting MSTR history: {e}")
            return []

    @staticmethod
    def get_rsi(ticker: str, db: Session, window: int = 14):
        """
        Calculate Relative Strength Index (RSI) from cached DB data.
        """
        try:
            from ..models import RawDailyPrice
            query = db.query(RawDailyPrice).filter(RawDailyPrice.ticker == ticker).order_by(RawDailyPrice.date.asc())
            data = pd.read_sql(query.statement, db.bind)
            
            if data.empty:
                return 50.0
            
            close = data['close_price']
            delta = close.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
            
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            return float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50.0
        except Exception as e:
            print(f"Error calculating RSI for {ticker}: {e}")
            return 50.0

    @staticmethod
    def get_moving_average(ticker: str, db: Session, window: int = 250):
        """
        Calculate Simple Moving Average (SMA) from cached DB data.
        """
        try:
            from ..models import RawDailyPrice
            query = db.query(RawDailyPrice).filter(RawDailyPrice.ticker == ticker).order_by(RawDailyPrice.date.asc())
            data = pd.read_sql(query.statement, db.bind)
            
            if data.empty:
                return 0.0
                
            close = data['close_price']
            ma = close.rolling(window=window).mean()
            return float(ma.iloc[-1]) if not pd.isna(ma.iloc[-1]) else 0.0
        except Exception as e:
            print(f"Error calculating MA for {ticker}: {e}")
            return 0.0

    @staticmethod
    def get_ndx_status(db: Session):
        """
        Returns current NDX price and its 250MA from cached DB data.
        """
        try:
            ticker = "QQQ"  # Yahoo Finance ticker for NDX index price feed — distinct from the renamed NDX_1X asset symbol
            from ..models import RawDailyPrice
            query = db.query(RawDailyPrice).filter(RawDailyPrice.ticker == ticker).order_by(RawDailyPrice.date.asc())
            data = pd.read_sql(query.statement, db.bind)
            
            if data.empty:
                return None
                
            close = data['close_price']
            current_price = float(close.iloc[-1])
            ma_250_series = close.rolling(window=250).mean()
            current_ma_250 = float(ma_250_series.iloc[-1]) if not pd.isna(ma_250_series.iloc[-1]) else 0.0
            
            return {
                "current_price": current_price,
                "ma_250": current_ma_250,
                "is_above_ma": current_price > current_ma_250
            }
        except Exception as e:
            print(f"Error getting NDX status: {e}")
            return None

    @staticmethod
    def get_asset_history(db: Session, ticker: str, period: str = "1y"):
        """Returns historical price and 250MA series for any cached ticker."""
        try:
            from ..models import RawDailyPrice
            query = db.query(RawDailyPrice).filter(RawDailyPrice.ticker == ticker).order_by(RawDailyPrice.date.asc())
            data = pd.read_sql(query.statement, db.bind)

            if data.empty:
                return []

            # Calculate 250MA
            data['ma_250'] = data['close_price'].rolling(window=250).mean()

            # Period filtering
            period_days = {"1m": 30, "3m": 90, "6m": 180, "1y": 365}.get(period.lower())
            if period_days:
                # Use KST-aware cutoff to match reporting logic
                from zoneinfo import ZoneInfo
                kst = ZoneInfo("Asia/Seoul")
                cutoff = (datetime.now(kst) - timedelta(days=period_days)).date()
                data = data[data['date'] >= cutoff]

            return [
                {
                    "date": row['date'].isoformat() if hasattr(row['date'], 'isoformat') else str(row['date']),
                    "price": round(float(row['close_price']), 2),
                    "ma_250": round(float(row['ma_250']), 2) if pd.notna(row['ma_250']) else None,
                }
                for _, row in data.iterrows()
            ]
        except Exception as e:
            print(f"Error getting history for {ticker}: {e}")
            return []

    @staticmethod
    def get_ndx_history(db: Session, period: str = "1y"):
        """Returns historical NDX price and 250MA series (proxied via QQQ)."""
        # QQQ = Yahoo Finance ticker for NDX price feed — distinct from the renamed NDX_1X asset symbol
        return QuantService.get_asset_history(db, "QQQ", period)
