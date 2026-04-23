from datetime import datetime, timedelta, date, timezone
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import func
import pandas as pd

from ..models import Asset, RawDailyPrice, PortfolioSnapshot, PortfolioPerformanceSnapshot
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
        performance_records = []
        coverage_start_date = None
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
                "invested_capital": float(day.get("invested_capital") or 0.0),
                "cash_balance": float(day.get("cash_balance") or 0.0)
            })

            if day.get("performance_coverage_status") == "ready" and day.get("performance_value") is not None:
                coverage_start_date = coverage_start_date or date_val
                performance_records.append({
                    "date": date_val,
                    "performance_value": float(day["performance_value"]),
                    "benchmark_value": float(day.get("benchmark_value") or 0.0),
                    "daily_return": float(day.get("performance_daily_return") or 0.0),
                    "alpha": float(day.get("performance_alpha") or 0.0),
                    "coverage_start_date": coverage_start_date,
                    "coverage_status": "ready",
                    "source_version": PortfolioService.VALUATION_VERSION,
                    "updated_at": datetime.now(timezone.utc),
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

        perf_count = 0
        for record in performance_records:
            stmt = insert(PortfolioPerformanceSnapshot).values(**record)
            stmt = stmt.on_conflict_do_update(
                index_elements=['date'],
                set_=dict(
                    performance_value=stmt.excluded.performance_value,
                    benchmark_value=stmt.excluded.benchmark_value,
                    daily_return=stmt.excluded.daily_return,
                    alpha=stmt.excluded.alpha,
                    coverage_start_date=stmt.excluded.coverage_start_date,
                    coverage_status=stmt.excluded.coverage_status,
                    source_version=stmt.excluded.source_version,
                    updated_at=stmt.excluded.updated_at,
                )
            )
            db.execute(stmt)
            perf_count += 1
        if performance_records:
            db.commit()
            print(f"Successfully generated/updated {perf_count} portfolio performance snapshots.")
