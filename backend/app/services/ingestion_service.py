import yfinance as yf
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import func

from ..models import Asset, RawDailyPrice, PortfolioSnapshot
from .portfolio_service import PortfolioService

class PriceIngestionService:
    @staticmethod
    def update_raw_prices(db: Session):
        # Query all distinct symbols from the assets table
        symbols = db.query(Asset.symbol).distinct().all()
        symbols = [s[0] for s in symbols if s[0]]

        today = datetime.now().date()

        for symbol in symbols:
            try:
                # Find maximum date in raw_daily_prices for this symbol
                max_date = db.query(func.max(RawDailyPrice.date)).filter(RawDailyPrice.ticker == symbol).scalar()

                if max_date is None:
                    # If no data exists, start from 3 years ago
                    start_date = today - timedelta(days=3 * 365)
                else:
                    # If data exists, start from max date + 1 day
                    start_date = max_date + timedelta(days=1)

                if start_date >= today:
                    print(f"[{symbol}] Data is up to date (max date: {max_date}). Skipping.")
                    continue

                print(f"[{symbol}] Fetching data from {start_date} to {today}...")
                
                # Fetch missing data using yfinance up to today
                ticker_obj = yf.Ticker(symbol)
                # yfinance end date is exclusive, so we can pass today if we just want up to yesterday,
                # but if we want today's data we might need end=today + timedelta(days=1) depending on yf behavior.
                # Adding 1 day to end to ensure today is fetched.
                end_date = today + timedelta(days=1)
                
                df = ticker_obj.history(start=start_date.isoformat(), end=end_date.isoformat())

                if df.empty:
                    print(f"[{symbol}] No new data returned from yfinance.")
                    continue
                
                records = []
                for index, row in df.iterrows():
                    record_date = index.date()
                    # Filter out records that are before start_date (just in case) or in the future
                    if record_date >= start_date and record_date <= today:
                        records.append({
                            "date": record_date,
                            "ticker": symbol,
                            "close_price": float(row["Close"])
                        })
                
                if records:
                    stmt = insert(RawDailyPrice).values(records)
                    # Use on_conflict_do_update to save or update fetched close_price gracefully
                    stmt = stmt.on_conflict_do_update(
                        index_elements=['date', 'ticker'],
                        set_={'close_price': stmt.excluded.close_price}
                    )
                    db.execute(stmt)
                    db.commit()
                    print(f"[{symbol}] Successfully inserted/updated {len(records)} records.")
                else:
                    print(f"[{symbol}] No valid records found to insert.")

            except Exception as e:
                db.rollback()
                print(f"[{symbol}] Error occurred: {str(e)}")

    @staticmethod
    def generate_portfolio_snapshots(db: Session):
        print("Generating portfolio snapshots...")
        history = PortfolioService.get_equity_curve(db, period="all")
        if not history:
            print("No history returned from get_equity_curve.")
            return

        records = []
        for day in history:
            # Handle both string and datetime types for flexibility
            date_val = day["date"]
            if isinstance(date_val, str):
                date_val = datetime.fromisoformat(date_val).date()
            elif isinstance(date_val, datetime):
                date_val = date_val.date()
                
            records.append({
                "date": date_val,
                "total_value": float(day["total_value"]),
                "invested_capital": 0.0,
                "cash_balance": 0.0
            })
        
        count = 0
        if records:
            for record in records:
                stmt = insert(PortfolioSnapshot).values(**record)
                stmt = stmt.on_conflict_do_update(
                    index_elements=['date'],
                    set_=dict(
                        total_value=stmt.excluded.total_value,
                        invested_capital=stmt.excluded.invested_capital,
                        cash_balance=stmt.excluded.cash_balance
                    )
                )
                db.execute(stmt)
                count += 1
            db.commit()
            print(f"Successfully generated/updated {count} portfolio snapshots.")
        else:
            print("No valid snapshot records to insert.")
