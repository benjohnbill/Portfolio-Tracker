import os
from fastapi import FastAPI, Depends, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta, timezone
import random
import time
from pydantic import BaseModel, Field
from typing import Optional, List

from .database import SessionLocal, engine, Base, get_db
from .models import Asset, Transaction, PortfolioSnapshot, RawDailyPrice, AccountType, AccountSilo, CronRunLog
from .services.price_service import PriceService
from .services.portfolio_service import PortfolioService
from .services.macro_service import MacroService
from .services.stress_service import StressService
from .services.kis_service import KISService
from .services.exchange_service import ExchangeService
from .services.quant_service import QuantService
from .services.algo_service import AlgoService
from .services.ingestion_service import PriceIngestionService
from .services.annotation_service import AnnotationService
from .services.report_service import ReportService
from .services.notification_service import NotificationService

app = FastAPI(title="Portfolio Tracker API", version="0.1.0")

@app.on_event("startup")
def on_startup():
    """Startup event - Seeding disabled to prevent conflicts during migration."""
    pass

# Request Models
class TransactionCreate(BaseModel):
    symbol: str
    type: str # BUY, SELL
    quantity: float
    price: Optional[float] = None
    date: Optional[str] = None # Change to str for easier Pydantic parsing from JSON
    account_type: Optional[str] = None
    account_silo: Optional[str] = None


class WeeklyReportGenerateRequest(BaseModel):
    week_ending: Optional[str] = None
    include_summary: bool = False


class EventAnnotationCreate(BaseModel):
    week_ending: str
    level: int
    title: str
    summary: str
    status: str = "active"
    affected_buckets: List[str] = Field(default_factory=list)
    affected_sleeves: List[str] = Field(default_factory=list)
    duration: Optional[str] = None
    decision_impact: Optional[str] = None
    source: str = "manual"
    event_date: Optional[str] = None

# CORS configuration
origins = ["*"] # Broaden for local development

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to Portfolio Tracker API"}


@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/assets")
def get_assets(db: Session = Depends(get_db)):
    """Returns list of all available assets"""
    assets = db.query(Asset).all()
    return [
        {
            "id": a.id,
            "symbol": a.symbol,
            "name": a.name,
            "code": a.code,
            "source": a.source
        } for a in assets
    ]

@app.get("/api/transactions")
def get_transactions(db: Session = Depends(get_db)):
    """Returns list of executed trades"""
    txs = db.query(Transaction).order_by(Transaction.date.desc()).all()
    return [
        {
            "id": t.id,
            "date": t.date.isoformat(),
            "asset": t.asset.symbol,
            "type": t.type,
            "quantity": t.quantity,
            "price": t.price,
            "total_amount": t.total_amount
        } for t in txs
    ]

@app.post("/api/transactions")
def create_transaction(tx: TransactionCreate, db: Session = Depends(get_db)):
    """Creates a new trade record, automatically creating new assets if they don't exist"""
    symbol_upper = tx.symbol.strip().upper()
    is_kr = symbol_upper.isdigit() and len(symbol_upper) == 6
    
    # 1. Find existing asset or create a new one
    asset = db.query(Asset).filter(Asset.symbol == symbol_upper).first()
    if not asset and is_kr:
        asset = db.query(Asset).filter(Asset.code == symbol_upper, Asset.source == "KR").first()

    requested_type = None
    if tx.account_type:
        try:
            requested_type = AccountType[tx.account_type.upper()]
        except KeyError:
            raise HTTPException(status_code=400, detail="Invalid account_type")

    requested_silo = None
    if tx.account_silo:
        try:
            requested_silo = AccountSilo[tx.account_silo.upper()]
        except KeyError:
            raise HTTPException(status_code=400, detail="Invalid account_silo")
    
    if not asset:
        source = "KR" if is_kr else "US"
        asset = Asset(
            symbol=symbol_upper if not is_kr else symbol_upper,
            code=symbol_upper,
            name=symbol_upper,
            source=source,
            account_type=requested_type or (AccountType.ISA if is_kr else AccountType.OVERSEAS),
            account_silo=requested_silo or (AccountSilo.ISA_ETF if is_kr else AccountSilo.OVERSEAS_ETF),
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
    else:
        source = asset.source

    if requested_type:
        asset.account_type = requested_type
    elif PortfolioService.sync_asset_classification(asset):
        db.add(asset)

    if requested_silo:
        asset.account_silo = requested_silo
        db.add(asset)
    db.commit()
    db.refresh(asset)
         
    # 2. Auto-fetch price if not provided
    final_price = tx.price
    if not final_price or final_price <= 0:
        if asset.account_silo == AccountSilo.BRAZIL_BOND or symbol_upper == "BRAZIL_BOND":
            fetched_price = KISService.get_brazil_bond_value()
        else:
            # Use the newly determined source
            fetched_price = PriceService.get_current_price(PortfolioService.get_price_lookup_ticker(asset), source=source)
            
        if fetched_price <= 0:
            # Fallback for BRAZIL_BOND if API is slow/down
            if asset.account_silo == AccountSilo.BRAZIL_BOND or symbol_upper == "BRAZIL_BOND":
                final_price = 1000.0 # Temporary placeholder
            else:
                raise HTTPException(status_code=400, detail=f"Could not auto-fetch price for {symbol_upper}. Please enter it manually.")
        else:
            final_price = fetched_price
        
    # 3. Parse date
    try:
        final_date = datetime.strptime(tx.date, "%Y-%m-%d").date() if tx.date else date.today()
    except:
        # Handle MM/DD/YYYY format if frontend sends it
        try:
            final_date = datetime.strptime(tx.date, "%m/%d/%Y").date()
        except:
            final_date = date.today()

    # 4. Create the transaction
    new_tx = Transaction(
        asset_id=asset.id,
        type=tx.type,
        quantity=tx.quantity,
        price=final_price,
        total_amount=tx.quantity * final_price,
        date=final_date,
        account_type=asset.account_type or AccountType.OVERSEAS,
    )
    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)
    return new_tx

@app.get("/api/portfolio/allocation")
def get_portfolio_allocation(db: Session = Depends(get_db)):
    """Calculates current holdings and weights in KRW"""
    return PortfolioService.get_portfolio_allocation(db)

@app.get("/api/portfolio/history")
def get_portfolio_history(period: str = "1y", db: Session = Depends(get_db)):
    """Returns portfolio value history for charts based on real transactions."""
    query = db.query(PortfolioSnapshot).order_by(PortfolioSnapshot.date.asc())
    
    today = date.today()
    if period == "1y":
        query = query.filter(PortfolioSnapshot.date >= today - timedelta(days=365))
    elif period == "ytd":
        query = query.filter(PortfolioSnapshot.date >= date(today.year, 1, 1))
    elif period == "1m":
        query = query.filter(PortfolioSnapshot.date >= today - timedelta(days=30))
    elif period == "3m":
        query = query.filter(PortfolioSnapshot.date >= today - timedelta(days=90))
        
    snapshots = query.all()
    if not snapshots:
        return []
        
    history = []
    prev_val = 0
    for s in snapshots:
        curr_val = s.total_value
        daily_return = (curr_val - prev_val) / prev_val if prev_val > 0 else 0
        history.append({
            "date": s.date.isoformat(),
            "total_value": curr_val,
            "daily_return": daily_return
        })
        prev_val = curr_val
        
    return history

@app.get("/api/portfolio/summary")
def get_portfolio_summary(db: Session = Depends(get_db)):
    """Returns high-level performance metrics (CAGR, MDD, Sharpe)."""
    return PortfolioService.get_portfolio_summary(db)

@app.get("/api/macro-vitals")
def get_macro_vitals():
    return MacroService.get_macro_vitals() or {"status": "loading"}

@app.get("/api/stress-test")
def get_stress_test(db: Session = Depends(get_db)):
    txs = db.query(Transaction).all()
    holdings = {}
    for t in txs: holdings[t.asset_id] = holdings.get(t.asset_id, 0) + (t.quantity if t.type == "BUY" else -t.quantity)
    active_holdings = {aid: qty for aid, qty in holdings.items() if qty > 0.0001}
    if not active_holdings: return []
    total_value = 0
    asset_values = {}
    for aid, qty in active_holdings.items():
        asset = db.query(Asset).filter(Asset.id == aid).first()
        price = PriceService.get_current_price(asset.symbol, asset.source)
        val = qty * price
        asset_values[asset.symbol] = val
        total_value += val
    if total_value == 0: return []
    weights = {sym: val / total_value for sym, val in asset_values.items()}
    return StressService.run_simulation(weights)

@app.get("/api/signals/vxn")
def get_vxn_signal(db: Session = Depends(get_db)):
    """Returns the VXN spike signal (current vs 90th percentile)"""
    try:
        signal = QuantService.get_vxn_signal(db)
        if not signal:
            raise HTTPException(status_code=404, detail="VXN signal data not available. Please run cron update.")
        return signal
    except Exception as e:
        print(f"Error in GET /api/signals/vxn: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/signals/mstr")
def get_mstr_signal(db: Session = Depends(get_db)):
    """Returns MSTR MNAV Z-score signal"""
    try:
        signal = QuantService.get_mstr_signal(db)
        if not signal:
            raise HTTPException(status_code=404, detail="MSTR signal data not available. Ensure corporate actions are seeded.")
        return signal
    except Exception as e:
        print(f"Error in GET /api/signals/mstr: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/algo/action-report")
def get_action_report(db: Session = Depends(get_db)):
    """Returns trade recommendations based on market signals and current allocation."""
    try:
        report = AlgoService.get_action_report(db)
        return report
    except Exception as e:
        print(f"Error in GET /api/algo/action-report: {e}")
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@app.get("/api/reports/weekly")
def list_weekly_reports(limit: int = 12, db: Session = Depends(get_db)):
    return ReportService.list_reports(db, limit=limit)


@app.get("/api/reports/weekly/latest")
def get_latest_weekly_report(db: Session = Depends(get_db)):
    try:
        return ReportService.get_latest_report(db)
    except Exception as e:
        print(f"Error in GET /api/reports/weekly/latest: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/weekly/{week_ending}")
def get_weekly_report(week_ending: str, db: Session = Depends(get_db)):
    try:
        parsed = datetime.strptime(week_ending, "%Y-%m-%d").date()
        report = ReportService.get_report_by_week(db, parsed)
        if not report:
            raise HTTPException(status_code=404, detail="Weekly report not found")
        return report
    except ValueError:
        raise HTTPException(status_code=400, detail="week_ending must be YYYY-MM-DD")


@app.post("/api/reports/weekly/generate")
def generate_weekly_report(payload: WeeklyReportGenerateRequest, db: Session = Depends(get_db)):
    try:
        week_ending = datetime.strptime(payload.week_ending, "%Y-%m-%d").date() if payload.week_ending else None
        return ReportService.generate_weekly_report(db, week_ending=week_ending, include_summary=payload.include_summary)
    except ValueError:
        raise HTTPException(status_code=400, detail="week_ending must be YYYY-MM-DD")
    except Exception as e:
        print(f"Error in POST /api/reports/weekly/generate: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reports/weekly/annotations")
def create_weekly_annotation(payload: EventAnnotationCreate, db: Session = Depends(get_db)):
    try:
        week_ending = datetime.strptime(payload.week_ending, "%Y-%m-%d").date()
        event_date = datetime.strptime(payload.event_date, "%Y-%m-%d").date() if payload.event_date else None
        return AnnotationService.create_annotation(
            db,
            week_ending=week_ending,
            level=payload.level,
            title=payload.title,
            summary=payload.summary,
            status=payload.status,
            affected_buckets=payload.affected_buckets,
            affected_sleeves=payload.affected_sleeves,
            duration=payload.duration,
            decision_impact=payload.decision_impact,
            source=payload.source,
            event_date=event_date,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")
    except Exception as e:
        print(f"Error in POST /api/reports/weekly/annotations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cron/update-signals")
def update_signals(x_cron_secret: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Secure endpoint for periodic data updates via GitHub Actions"""
    expected_secret = os.getenv("CRON_SECRET")
    if not expected_secret or x_cron_secret != expected_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing cron secret"
        )
    
    # Ensure CronRunLog table exists
    CronRunLog.__table__.create(bind=engine, checkfirst=True)
    
    # Start tracking
    start_time = time.time()
    started_at = datetime.now(timezone.utc)
    current_step = "init"
    
    # Create initial run log entry
    run_log = CronRunLog(
        job_name="update-signals",
        started_at=started_at,
        status="running",
    )
    db.add(run_log)
    db.commit()
    db.refresh(run_log)
    
    try:
        current_step = "price_ingestion"
        PriceIngestionService.update_raw_prices(db)
        
        current_step = "portfolio_snapshots"
        PriceIngestionService.generate_portfolio_snapshots(db)
        
        current_step = "vxn_update"
        vxn_updated = QuantService.update_vxn_history(db)
        
        current_step = "mstr_seed"
        mstr_seeded = QuantService.seed_mstr_corporate_actions(db)
        
        current_step = "weekly_report"
        weekly_report = ReportService.generate_weekly_report(
            db,
            include_summary=os.getenv("WEEKLY_REPORT_LLM_PROVIDER") in {"openai", "gemini"}
            and bool(os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY_MAIN")),
        )
        
        # Calculate duration and update run log
        duration = time.time() - start_time
        finished_at = datetime.now(timezone.utc)
        weekly_score = weekly_report.get("score", {}).get("total")
        
        run_log.finished_at = finished_at
        run_log.status = "success"
        run_log.duration_seconds = duration
        run_log.details_json = {
            "vxn_updated": vxn_updated,
            "mstr_seeded": mstr_seeded,
            "weekly_score": weekly_score,
            "week_ending": weekly_report.get("weekEnding"),
        }
        db.commit()
        
        # Send success notification
        NotificationService.send_cron_success(
            duration_seconds=duration,
            vxn_updated=vxn_updated,
            mstr_seeded=mstr_seeded,
            weekly_score=weekly_score,
        )
        
        return {
            "status": "success", 
            "message": "Prices, snapshots, VXN history updated and weekly report generated.",
            "vxn_updated": vxn_updated,
            "mstr_seeded": mstr_seeded,
            "weekly_report": {
                "weekEnding": weekly_report.get("weekEnding"),
                "score": weekly_score,
            },
            "duration_seconds": round(duration, 2),
        }
    except Exception as e:
        # Calculate duration and update run log with failure
        duration = time.time() - start_time
        finished_at = datetime.now(timezone.utc)
        error_message = str(e)
        
        run_log.finished_at = finished_at
        run_log.status = "failed"
        run_log.duration_seconds = duration
        run_log.error_message = error_message
        run_log.details_json = {"failed_step": current_step}
        db.commit()
        
        # Send failure notification
        NotificationService.send_cron_failure(
            error_message=error_message,
            duration_seconds=duration,
            step=current_step,
        )
        
        print(f"Error in POST /api/cron/update-signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notifications/test")
def test_notification(x_cron_secret: Optional[str] = Header(None)):
    """Test endpoint to verify Telegram notification setup."""
    expected_secret = os.getenv("CRON_SECRET")
    if not expected_secret or x_cron_secret != expected_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing cron secret"
        )
    
    success = NotificationService.send_test_message()
    if success:
        return {"status": "success", "message": "Test notification sent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send test notification. Check Telegram configuration.")


def generate_mock_history(start_date, end_date):
    mock_data = []
    current_date = start_date
    value = 10000000
    while current_date <= end_date:
        change_pct = random.uniform(-0.01, 0.012)
        value = value * (1 + change_pct)
        mock_data.append({"date": current_date.isoformat(), "total_value": int(value), "daily_return": change_pct * 100})
        current_date += timedelta(days=1)
    return mock_data
