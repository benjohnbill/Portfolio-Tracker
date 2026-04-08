from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import func
import pandas as pd

from ..models import Asset, RawDailyPrice, PortfolioSnapshot
from .portfolio_service import PortfolioService
from .price_service import PriceService

class PriceIngestionService:
    @staticmethod
    def update_raw_prices(db: Session):
        assets = db.query(Asset).all()

        today = datetime.now().date()

        for asset in assets:
            if not asset.symbol:
                continue
            PortfolioService.sync_asset_classification(asset)
            if asset.account_silo and asset.account_silo.value == "BRAZIL_BOND":
                continue

            ticker = PortfolioService.get_price_lookup_ticker(asset)
            try:
                # Find maximum date in raw_daily_prices for this ticker
                max_date = db.query(func.max(RawDailyPrice.date)).filter(RawDailyPrice.ticker == ticker).scalar()

                if max_date is None:
                    # If no data exists, start from 3 years ago
                    start_date = today - timedelta(days=3 * 365)
                else:
                    # If data exists, start from max date + 1 day
                    start_date = max_date + timedelta(days=1)

                if start_date >= today:
                    print(f"[{ticker}] Data is up to date (max date: {max_date}). Skipping.")
                    continue

                print(f"[{ticker}] Fetching data from {start_date} to {today}...")

                end_date = today + timedelta(days=1)

                price_history = PriceService.get_historical_prices(
                    ticker,
                    start_date.isoformat(),
                    end_date.isoformat(),
                    source=asset.source,
                )

                if isinstance(price_history, pd.DataFrame):
                    price_history = price_history.squeeze()

                if not isinstance(price_history, pd.Series) or price_history.empty:
                    print(f"[{ticker}] No new data returned from price service.")
                    continue

                records = []
                for index, close_price in price_history.dropna().items():
                    record_date = index.date() if hasattr(index, "date") else pd.Timestamp(index).date()
                    # Filter out records that are before start_date (just in case) or in the future
                    if record_date >= start_date and record_date <= today:
                        records.append({
                            "date": record_date,
                            "ticker": ticker,
                            "close_price": float(close_price)
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
                    print(f"[{ticker}] Successfully inserted/updated {len(records)} records.")
                else:
                    print(f"[{ticker}] No valid records found to insert.")

            except Exception as e:
                db.rollback()
                print(f"[{ticker}] Error occurred: {str(e)}")

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
