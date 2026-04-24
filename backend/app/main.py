import logging
import os
from fastapi import FastAPI, Depends, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta, timezone
import random
import time
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

from .api._envelope import wrap_response
from .database import SessionLocal, engine, Base, get_db
from .models import Asset, Transaction, RawDailyPrice, AccountType, AccountSilo, CronRunLog, WeeklySnapshot, PortfolioPerformanceSnapshot
from .services.cache_service import CacheService
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
from .services.friday_service import FridayService, DecisionNotFoundError, SnapshotConflictError, SnapshotNotFoundError, SnapshotValidationError
from .services.report_service import ReportService
from .services.notification_service import NotificationService
from .services.discord_notifier import send_discord_message
from .services.attribution_service import AttributionService
from .services.intelligence_service import IntelligenceService
from .services.outcome_evaluator import OutcomeEvaluatorService

logger = logging.getLogger(__name__)

app = FastAPI(title="Portfolio Tracker API", version="0.1.0")

@app.on_event("startup")
def on_startup():
    """Startup event - Seeding disabled to prevent conflicts during migration."""
    pass

# Request Models
class TransactionCreate(BaseModel):
    symbol: Optional[str] = None
    type: str # BUY, SELL, DEPOSIT, WITHDRAW
    quantity: Optional[float] = None
    price: Optional[float] = None
    total_amount: Optional[float] = None
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


class FridaySnapshotCreateRequest(BaseModel):
    snapshot_date: Optional[str] = None
    # Phase D A7 — optional per-freeze observation, 1-2 lines.
    comment: Optional[str] = None


class FridayDecisionCreateRequest(BaseModel):
    snapshot_id: int
    decision_type: str
    asset_ticker: Optional[str] = None
    note: str
    # Phase D A3 — three confidence scalars. Primary (vs SPY risk-adj) required;
    # cash + SPY-pure are optional until the UI surfaces them consistently.
    confidence_vs_spy_riskadj: int = Field(ge=1, le=10)
    confidence_vs_cash: Optional[int] = Field(default=None, ge=1, le=10)
    confidence_vs_spy_pure: Optional[int] = Field(default=None, ge=1, le=10)
    # Phase D A4 — structured invalidation alongside the existing free-text field.
    invalidation: Optional[str] = None
    expected_failure_mode: Optional[str] = None
    trigger_threshold: Optional[float] = None


class SlippageCreateRequest(BaseModel):
    decision_id: int
    executed_at: Optional[str] = None   # YYYY-MM-DD
    executed_price: Optional[float] = None
    executed_qty: Optional[float] = None
    notes: Optional[str] = None

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
            "asset": t.asset.symbol if t.asset else None,
            "type": t.type,
            "quantity": t.quantity,
            "price": t.price,
            "total_amount": t.total_amount
        } for t in txs
    ]


def _serialize_transaction(t: Transaction) -> Dict[str, Any]:
    return {
        "id": t.id,
        "date": t.date.isoformat() if t.date else None,
        "asset": t.asset.symbol if t.asset else None,
        "type": t.type,
        "quantity": t.quantity,
        "price": t.price,
        "total_amount": t.total_amount,
        "account_type": t.account_type.value if t.account_type else None,
    }


@app.post("/api/transactions")
def create_transaction(tx: TransactionCreate, db: Session = Depends(get_db)):
    """Creates a trade or external cashflow record."""
    tx_type = (tx.type or "").upper()

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

    try:
        final_date = datetime.strptime(tx.date, "%Y-%m-%d").date() if tx.date else date.today()
    except:
        try:
            final_date = datetime.strptime(tx.date, "%m/%d/%Y").date()
        except:
            final_date = date.today()

    if tx_type in {"DEPOSIT", "WITHDRAW"}:
        if tx.symbol or tx.quantity is not None or tx.price is not None:
            raise HTTPException(status_code=400, detail="Cashflow transactions must not include symbol, quantity, or price")
        if tx.total_amount is None or tx.total_amount <= 0:
            raise HTTPException(status_code=400, detail="Cashflow transactions require positive total_amount")

        new_tx = Transaction(
            asset_id=None,
            type=tx_type,
            quantity=None,
            price=None,
            total_amount=float(tx.total_amount),
            date=final_date,
            account_type=requested_type or AccountType.OVERSEAS,
        )
        db.add(new_tx)
        db.commit()
        db.refresh(new_tx)
        PortfolioService.clear_cache(db)
        CacheService.invalidate_cache(db, FridayService.UX1_FRIDAY_CURRENT_KEY)
        return _serialize_transaction(new_tx)

    if tx_type not in {"BUY", "SELL"}:
        raise HTTPException(status_code=400, detail="type must be BUY, SELL, DEPOSIT, or WITHDRAW")
    if not tx.symbol or tx.quantity is None or tx.quantity <= 0:
        raise HTTPException(status_code=400, detail="Trade transactions require symbol and positive quantity")

    symbol_upper = tx.symbol.strip().upper()
    is_kr = symbol_upper.isdigit() and len(symbol_upper) == 6
    
    # 1. Find existing asset or create a new one
    asset = db.query(Asset).filter(Asset.symbol == symbol_upper).first()
    if not asset and is_kr:
        asset = db.query(Asset).filter(Asset.code == symbol_upper, Asset.source == "KR").first()

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
        
    # 4. Create the transaction
    new_tx = Transaction(
        asset_id=asset.id,
        type=tx_type,
        quantity=tx.quantity,
        price=final_price,
        total_amount=tx.quantity * final_price,
        date=final_date,
        account_type=asset.account_type or AccountType.OVERSEAS,
    )
    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)
    
    # Invalidate cache so new transactions are reflected immediately
    PortfolioService.clear_cache(db)
    CacheService.invalidate_cache(db, FridayService.UX1_FRIDAY_CURRENT_KEY)

    return _serialize_transaction(new_tx)

@app.get("/api/portfolio/allocation")
def get_portfolio_allocation(db: Session = Depends(get_db)):
    """Calculates current holdings and weights in KRW"""
    return PortfolioService.get_portfolio_allocation(db)


def _coerce_iso_date(value: Any) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _performance_value(row: Any) -> Optional[float]:
    for field in ("performance_value", "neutralized_value", "neutralized_performance_value"):
        value = getattr(row, field, None)
        if value is not None:
            return float(value)
    return None


def _load_portfolio_performance_history(
    db: Session,
    start_date: Optional[date],
    end_date: date,
) -> Dict[str, Any]:
    """Load covered cashflow-neutral history without falling back to absolute snapshots."""
    query = db.query(PortfolioPerformanceSnapshot)
    if start_date is not None:
        query = query.filter(PortfolioPerformanceSnapshot.date >= start_date)
    try:
        rows = (
            query
            .filter(PortfolioPerformanceSnapshot.date <= end_date)
            .order_by(PortfolioPerformanceSnapshot.date.asc())
            .all()
        )
    except SQLAlchemyError:
        db.rollback()
        return {"coverage_start": None, "status": "unavailable", "series": []}

    series = []
    coverage_start = None
    statuses = []
    for row in rows:
        status = getattr(row, "coverage_status", "ready") or "ready"
        if status == "unavailable":
            continue
        value = _performance_value(row)
        if value is None:
            continue
        row_coverage_start = _coerce_iso_date(getattr(row, "coverage_start_date", None))
        coverage_start = coverage_start or row_coverage_start or _coerce_iso_date(getattr(row, "date", None))
        statuses.append(status)
        series.append({
            "date": _coerce_iso_date(row.date),
            "performance_value": value,
            "benchmark_value": float(getattr(row, "benchmark_value", 0) or 0),
            "alpha": float(getattr(row, "alpha", 0) or 0),
            "daily_return": float(getattr(row, "daily_return", 0) or 0),
        })

    if not series:
        return {"coverage_start": None, "status": "unavailable", "series": []}

    return {
        "coverage_start": coverage_start,
        "status": "partial" if any(status == "partial" for status in statuses) else "ready",
        "series": series,
    }


@app.get("/api/portfolio/history")
def get_portfolio_history(period: str = "1y", db: Session = Depends(get_db)):
    """Return split archive and cashflow-neutral performance histories."""
    history = PortfolioService.get_equity_curve(db, period=period)
    archive_series = [
        {
            "date": day["date"],
            "absolute_wealth": day["total_value"],
            "invested_capital": day.get("invested_capital"),
            "cash_balance": day.get("cash_balance"),
            "net_cashflow": day.get("net_cashflow"),
        }
        for day in history
    ]
    start_date = date.fromisoformat(archive_series[0]["date"]) if archive_series else None
    return {
        "period": period,
        "archive": {"series": archive_series},
        "performance": _load_portfolio_performance_history(db, start_date, date.today()),
    }

@app.get("/api/portfolio/summary")
def get_portfolio_summary(db: Session = Depends(get_db)):
    """Returns high-level performance metrics (CAGR, MDD, Sharpe)."""
    return PortfolioService.get_portfolio_summary(db)

@app.get("/api/macro-vitals")
def get_macro_vitals():
    return MacroService.get_macro_vitals() or {"status": "loading"}

@app.get("/api/stress-test")
def get_stress_test(db: Session = Depends(get_db)):
    txs = db.query(Transaction).filter(Transaction.type.in_(["BUY", "SELL"])).all()
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

@app.get("/api/signals/mstr-history")
def get_mstr_history(period: str = "1y", db: Session = Depends(get_db)):
    """Returns historical MSTR Z-score and MNAV ratio series for charting."""
    return QuantService.get_mstr_history(db, period=period)

@app.get("/api/signals/ndx-history")
def get_ndx_history(period: str = "1y", db: Session = Depends(get_db)):
    """Returns historical NDX price and 250MA series for charting."""
    return QuantService.get_ndx_history(db, period=period)

@app.get("/api/signals/history")
def get_asset_history(ticker: str, period: str = "1y", db: Session = Depends(get_db)):
    """Returns historical price and 250MA series for any cached ticker."""
    return QuantService.get_asset_history(db, ticker, period=period)

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
    """UX-1 envelope: always HTTP 200; failures absorb into status='unavailable'."""
    try:
        report = ReportService.get_latest_report(db)
        if not report:
            return wrap_response(status="unavailable", report=None)
        return wrap_response(status="ready", report=report)
    except Exception as e:
        logger.warning("weekly_latest_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", report=None)


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


@app.post("/api/v1/friday/snapshot")
def create_friday_snapshot(payload: FridaySnapshotCreateRequest, db: Session = Depends(get_db)):
    try:
        snapshot_date = datetime.strptime(payload.snapshot_date, "%Y-%m-%d").date() if payload.snapshot_date else None
        return FridayService.create_snapshot(db, snapshot_date=snapshot_date, comment=payload.comment)
    except ValueError as exc:
        if isinstance(exc, SnapshotConflictError):
            raise HTTPException(status_code=409, detail=str(exc))
        if isinstance(exc, SnapshotValidationError):
            raise HTTPException(status_code=400, detail=str(exc))
        raise HTTPException(status_code=400, detail="snapshot_date must be YYYY-MM-DD")
    except Exception as e:
        print(f"Error in POST /api/v1/friday/snapshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/friday/snapshots")
def list_friday_snapshots(db: Session = Depends(get_db)):
    try:
        snapshots = FridayService.list_snapshots(db)
        return wrap_response(
            status="ready",
            count=len(snapshots),
            snapshots=snapshots,
        )
    except Exception as e:
        logger.warning("friday_snapshots_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", count=0, snapshots=[])


@app.get("/api/v1/friday/briefing")
def get_friday_briefing(since: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        since_date = datetime.strptime(since, "%Y-%m-%d").date() if since else None
    except ValueError:
        raise HTTPException(status_code=400, detail="since must be YYYY-MM-DD")

    try:
        from .services.briefing_service import BriefingService
        briefing = BriefingService.get_briefing(db, since=since_date)
        return wrap_response(status="ready", **briefing)
    except Exception as e:
        logger.warning("friday_briefing_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            sinceDate=None,
            regimeTransitions=[],
            maturedOutcomes=[],
            alertHistory={
                "success": 0,
                "failed": 0,
                "lastFailureAt": None,
                "lastFailureMessage": None,
            },
            lastSnapshotComment=None,
        )


@app.get("/api/v1/friday/sleeve-history")
def get_friday_sleeve_history(weeks: int = 4, db: Session = Depends(get_db)):
    try:
        from .services.briefing_service import BriefingService
        sleeves = BriefingService.get_sleeve_history(db, weeks=weeks)
        return wrap_response(status="ready", sleeves=sleeves)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as e:
        logger.warning("friday_sleeve_history_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", sleeves={})


@app.get("/api/v1/friday/snapshot/{snapshot_date}")
def get_friday_snapshot(snapshot_date: str, db: Session = Depends(get_db)):
    try:
        parsed = datetime.strptime(snapshot_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="snapshot_date must be YYYY-MM-DD")

    try:
        snapshot = FridayService.get_snapshot(db, parsed)
        coverage = FridayService.compute_snapshot_coverage(snapshot)
        # Only 'portfolio' and 'macro' are required for ready. The other four
        # flags are informational (optional sections that may legitimately be empty).
        required_ok = coverage["portfolio"] and coverage["macro"]
        status = "ready" if required_ok else "partial"
        return wrap_response(
            status=status,
            date=snapshot_date,
            coverage=coverage,
            snapshot=snapshot,
        )
    except SnapshotNotFoundError:
        return wrap_response(
            status="unavailable",
            date=snapshot_date,
            coverage=FridayService.compute_snapshot_coverage(None),
            snapshot=None,
        )
    except Exception as e:
        logger.warning("friday_snapshot_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            date=snapshot_date,
            coverage=FridayService.compute_snapshot_coverage(None),
            snapshot=None,
        )


@app.post("/api/v1/friday/decisions")
def create_friday_decision(payload: FridayDecisionCreateRequest, db: Session = Depends(get_db)):
    try:
        return FridayService.add_decision(
            db,
            snapshot_id=payload.snapshot_id,
            decision_type=payload.decision_type,
            asset_ticker=payload.asset_ticker,
            note=payload.note,
            confidence_vs_spy_riskadj=payload.confidence_vs_spy_riskadj,
            confidence_vs_cash=payload.confidence_vs_cash,
            confidence_vs_spy_pure=payload.confidence_vs_spy_pure,
            invalidation=payload.invalidation,
            expected_failure_mode=payload.expected_failure_mode,
            trigger_threshold=payload.trigger_threshold,
        )
    except SnapshotNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except SnapshotValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as e:
        print(f"Error in POST /api/v1/friday/decisions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/friday/slippage")
def create_friday_slippage(payload: SlippageCreateRequest, db: Session = Depends(get_db)):
    try:
        executed_at = datetime.strptime(payload.executed_at, "%Y-%m-%d").date() if payload.executed_at else None
    except ValueError:
        raise HTTPException(status_code=400, detail="executed_at must be YYYY-MM-DD")

    try:
        return FridayService.add_slippage(
            db,
            decision_id=payload.decision_id,
            executed_at=executed_at,
            executed_price=payload.executed_price,
            executed_qty=payload.executed_qty,
            notes=payload.notes,
        )
    except DecisionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as e:
        print(f"Error in POST /api/v1/friday/slippage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/friday/compare")
def compare_friday_snapshots(a: str, b: str, db: Session = Depends(get_db)):
    try:
        parsed_a = datetime.strptime(a, "%Y-%m-%d").date()
        parsed_b = datetime.strptime(b, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")

    try:
        comparison = FridayService.compare_snapshots(db, parsed_a, parsed_b)
        # Defensive: current service raises on missing snapshots, but keep the
        # unavailable path in case that contract loosens to return None.
        if not comparison:
            return wrap_response(status="unavailable", a=a, b=b, comparison=None)
        return wrap_response(status="ready", a=a, b=b, comparison=comparison)
    except SnapshotNotFoundError:
        return wrap_response(status="unavailable", a=a, b=b, comparison=None)
    except Exception as e:
        logger.warning("friday_compare_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", a=a, b=b, comparison=None)


@app.get("/api/v1/friday/current")
def get_friday_current(db: Session = Depends(get_db)):
    try:
        report = FridayService.get_current_report_cached(db)
        if not report:
            return wrap_response(status="unavailable", report=None)
        return wrap_response(status="ready", report=report)
    except Exception as e:
        logger.warning("friday_current_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", report=None)

# ---------------------------------------------------------------------------
# Intelligence API
# ---------------------------------------------------------------------------

@app.get("/api/intelligence/attributions")
def get_intelligence_attributions(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Time series of score decompositions across date range."""
    try:
        from_date = date.fromisoformat(date_from) if date_from else None
        to_date = date.fromisoformat(date_to) if date_to else None
    except ValueError:
        raise HTTPException(status_code=400, detail="date_from/date_to must be YYYY-MM-DD")

    try:
        attributions = IntelligenceService.get_attributions(db, date_from=from_date, date_to=to_date)
        return wrap_response(
            status="ready",
            date_from=date_from,
            date_to=date_to,
            attributions=attributions or [],
        )
    except Exception as e:
        logger.warning("intelligence_attributions_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            date_from=date_from,
            date_to=date_to,
            attributions=[],
        )


@app.get("/api/intelligence/attributions/{snapshot_date}")
def get_intelligence_attribution_detail(snapshot_date: str, db: Session = Depends(get_db)):
    """Single snapshot's full attribution breakdown."""
    parsed = date.fromisoformat(snapshot_date)
    result = IntelligenceService.get_attribution_by_date(db, parsed)
    if not result:
        raise HTTPException(status_code=404, detail="Attribution not found for this date")
    return result


@app.get("/api/intelligence/outcomes")
def get_intelligence_outcomes(
    horizon: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Decision outcomes evaluated at specified horizon."""
    if horizon and horizon not in ("1w", "1m", "3m", "6m", "1y"):
        raise HTTPException(status_code=400, detail="Invalid horizon. Use: 1w, 1m, 3m, 6m, 1y")

    try:
        outcomes = IntelligenceService.get_outcomes(db, horizon=horizon)
        return wrap_response(
            status="ready",
            horizon=horizon,
            outcomes=outcomes or [],
        )
    except Exception as e:
        logger.warning("intelligence_outcomes_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            horizon=horizon,
            outcomes=[],
        )


@app.get("/api/intelligence/rules/accuracy")
def get_intelligence_rule_accuracy(db: Session = Depends(get_db)):
    """Per-rule accuracy: times fired, times followed, follow rate."""
    try:
        rules = IntelligenceService.get_rule_accuracy(db)
        return wrap_response(status="ready", rules=rules or [])
    except Exception as e:
        logger.warning("intelligence_rules_accuracy_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", rules=[])


@app.get("/api/intelligence/regime/history")
def get_intelligence_regime_history(db: Session = Depends(get_db)):
    """Regime transitions timeline with before/after portfolio state."""
    try:
        transitions = IntelligenceService.get_regime_history(db)
        return wrap_response(status="ready", transitions=transitions or [])
    except Exception as e:
        logger.warning("intelligence_regime_history_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", transitions=[])


@app.get("/api/intelligence/reviews/summary")
def get_intelligence_review_summary(db: Session = Depends(get_db)):
    """Available review periods with data counts."""
    try:
        summary = IntelligenceService.get_review_summary(db)
        return wrap_response(status="ready", summary=summary)
    except Exception as e:
        logger.warning("intelligence_reviews_summary_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            summary={
                "totalWeeks": 0,
                "months": [],
                "quarters": [],
                "years": [],
            },
        )


@app.get("/api/intelligence/reviews/monthly")
def get_intelligence_monthly_review(month: str, db: Session = Depends(get_db)):
    """Monthly aggregation (month=YYYY-MM)."""
    result = IntelligenceService.get_monthly_review(db, month)
    if not result:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")
    return result


@app.get("/api/intelligence/reviews/quarterly")
def get_intelligence_quarterly_review(quarter: str, db: Session = Depends(get_db)):
    """Quarterly aggregation (quarter=YYYY-Q1)."""
    result = IntelligenceService.get_quarterly_review(db, quarter)
    if not result:
        raise HTTPException(status_code=400, detail="Invalid quarter format. Use YYYY-Q1")
    return result


@app.get("/api/intelligence/reviews/annual")
def get_intelligence_annual_review(year: str, db: Session = Depends(get_db)):
    """Annual aggregation (year=YYYY)."""
    result = IntelligenceService.get_annual_review(db, year)
    if not result:
        raise HTTPException(status_code=400, detail="Invalid year format. Use YYYY")
    return result


@app.get("/api/v1/intelligence/risk-adjusted/scorecard")
def get_risk_adjusted_scorecard(db: Session = Depends(get_db)):
    """B5 — multi-horizon risk-adjusted scorecard."""
    from .services.risk_adjusted_service import RiskAdjustedService
    return RiskAdjustedService.scorecard(db)


@app.get("/api/v1/intelligence/risk-adjusted/calmar-trajectory")
def get_calmar_trajectory(db: Session = Depends(get_db)):
    """B4 — Calmar ratio trajectory over accumulated freezes."""
    from .services.risk_adjusted_service import RiskAdjustedService
    return RiskAdjustedService.calmar_trajectory(db)


@app.post("/api/admin/backfill-attributions")
def backfill_attributions(db: Session = Depends(get_db)):
    """One-time backfill of scoring_attributions for all existing weekly_snapshots."""
    count = AttributionService.backfill_all(db)
    return {"count": count}


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
        
        # Pre-warm EOD Materialized JSON Cache
        current_step = "cache_prewarm"
        PortfolioService.clear_cache(db)
        PortfolioService.get_portfolio_summary(db)
        PortfolioService.get_portfolio_allocation(db)
        for p in ["1m", "3m", "6m", "1y", "all"]:
            PortfolioService.get_equity_curve(db, period=p)

        # Step 7: Attribution compute (non-blocking — failure here doesn't fail the cron)
        attribution_ok = True
        try:
            current_step = "attribution_compute"
            AttributionService.compute_latest(db)
        except Exception:
            attribution_ok = False

        # Step 8: Decision outcome evaluation (non-blocking)
        outcomes_created = 0
        try:
            current_step = "outcome_evaluation"
            outcomes_created = IntelligenceService.evaluate_decision_outcomes(db)
        except Exception:
            pass

        # Step 9: Regime transition alerts (non-blocking)
        regime_alerts_sent = 0
        try:
            current_step = "regime_alerts"
            transitions = IntelligenceService.detect_regime_transitions(db)
            if transitions:
                for t in transitions:
                    msg = f"Regime Shift: {t['bucket']} changed from {t['from']} to {t['to']}. Score: {t['totalScore']}/100"
                    NotificationService.send_telegram_message(msg)
                    send_discord_message(msg)
                    regime_alerts_sent += 1
        except Exception:
            pass

        # Step 10: Backfill SPY-KRW delta columns on matured outcomes (B2, non-blocking)
        spy_delta_result = {"processed": 0, "skipped_insufficient_data": 0, "errors": 0}
        try:
            current_step = "spy_delta_backfill"
            spy_delta_result = OutcomeEvaluatorService.backfill_spy_deltas(db)
        except Exception:
            pass

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
            "attribution_ok": attribution_ok,
            "outcomes_created": outcomes_created,
            "regime_alerts_sent": regime_alerts_sent,
            "spy_delta_processed": spy_delta_result.get("processed", 0),
        }
        db.commit()

        # Fetch the most recent snapshot comment for the Discord/Telegram echo.
        # Stateless query; keeps NotificationService DB-agnostic.
        latest_snapshot = (
            db.query(WeeklySnapshot)
            .order_by(WeeklySnapshot.snapshot_date.desc())
            .first()
        )
        latest_comment = latest_snapshot.comment if latest_snapshot else None

        # Send success notification
        NotificationService.send_cron_success(
            duration_seconds=duration,
            vxn_updated=vxn_updated,
            mstr_seeded=mstr_seeded,
            weekly_score=weekly_score,
            latest_comment=latest_comment,
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
