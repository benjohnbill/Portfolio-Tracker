import os
from fastapi import FastAPI, Depends, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta
import random
from pydantic import BaseModel
from typing import Optional

from .database import SessionLocal, engine, Base, get_db
from .models import Asset, Transaction
from .services.price_service import PriceService
from .services.portfolio_service import PortfolioService
from .services.macro_service import MacroService
from .services.stress_service import StressService
from .services.kis_service import KISService
from .services.exchange_service import ExchangeService
from .services.quant_service import QuantService
from .services.algo_service import AlgoService

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
    
    # 1. Find existing asset or create a new one
    asset = db.query(Asset).filter(Asset.symbol == symbol_upper).first()
    
    if not asset:
        is_kr = symbol_upper.isdigit() and len(symbol_upper) == 6
        source = "KR" if is_kr else "US"
        asset = Asset(
            symbol=symbol_upper,
            code=symbol_upper,
            name=symbol_upper,
            source=source
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        
    # 2. Auto-fetch price if not provided
    final_price = tx.price
    if not final_price or final_price <= 0:
        if symbol_upper == "BRAZIL_BOND":
            fetched_price = KISService.get_brazil_bond_value()
        else:
            # Use the newly determined source
            fetched_price = PriceService.get_current_price(symbol_upper, source=source)
            
        if fetched_price <= 0:
            # Fallback for BRAZIL_BOND if API is slow/down
            if symbol_upper == "BRAZIL_BOND":
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
        date=final_date
    )
    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)
    return new_tx

@app.get("/api/portfolio/allocation")
def get_portfolio_allocation(db: Session = Depends(get_db)):
    """Calculates current holdings and weights in KRW"""
    txs = db.query(Transaction).all()
    holdings = {} # {asset_id: quantity}
    for t in txs:
        if t.asset_id not in holdings: holdings[t.asset_id] = 0
        holdings[t.asset_id] += t.quantity if t.type == "BUY" else -t.quantity

    active_holdings = {k: v for k, v in holdings.items() if v > 0.0001}
    if not active_holdings: return []

    current_fx = ExchangeService.get_current_rate()
    brazil_bond_current_value = KISService.get_brazil_bond_value()
    
    result = []
    total_value = 0
    
    for asset_id, qty in active_holdings.items():
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        
        # Special case for Brazil Bond
        if asset.symbol == "BRAZIL_BOND":
            if brazil_bond_current_value <= 0:
                last_tx = db.query(Transaction).filter(Transaction.asset_id == asset_id).order_by(Transaction.date.desc()).first()
                current_price = last_tx.price if last_tx else 1860000.0
                value_krw = qty * current_price
            else:
                current_price = brazil_bond_current_value / qty if qty > 0 else 0
                value_krw = brazil_bond_current_value
        else:
            current_price = PriceService.get_current_price(asset.code if asset.source == "KR" else asset.symbol, asset.source)
            if current_price == 0:
                last_tx = db.query(Transaction).filter(Transaction.asset_id == asset_id).order_by(Transaction.date.desc()).first()
                current_price = last_tx.price if last_tx else 100.0 
            value_krw = qty * current_price * (current_fx if asset.source == "US" else 1.0)
            
        total_value += value_krw
        result.append({
            "asset": asset.symbol,
            "name": asset.name,
            "quantity": qty,
            "price": current_price,
            "value": value_krw,
            "weight": 0,
            "source": asset.source,
            "account_type": asset.account_type.value if asset.account_type else "OVERSEAS"
        })

    for item in result:
        item["weight"] = item["value"] / total_value if total_value > 0 else 0
        
    return sorted(result, key=lambda x: x["value"], reverse=True)

@app.get("/api/portfolio/history")
def get_portfolio_history(period: str = "1y", db: Session = Depends(get_db)):
    """Returns portfolio value history for charts based on real transactions."""
    history = PortfolioService.get_equity_curve(db, period)
    return history if history else generate_mock_history(date.today() - timedelta(days=30), date.today())

@app.get("/api/portfolio/summary")
def get_portfolio_summary(db: Session = Depends(get_db)):
    """Returns high-level performance metrics (CAGR, MDD, Sharpe)."""
    history = PortfolioService.get_equity_curve(db, period="all")
    if not history: return {"total_value": 0, "metrics": {}}
    
    # Calculate total invested capital (sum of all BUYs - sum of all SELLs at cost)
    txs = db.query(Transaction).all()
    invested_capital = 0
    for t in txs:
        if t.type == "BUY":
            invested_capital += t.total_amount
        elif t.type == "SELL":
            # Rough approximation: subtract the original cost basis if we had it, 
            # but for now we just subtract the sell amount to reflect current net capital out.
            invested_capital -= t.total_amount
            
    metrics = PortfolioService.calculate_metrics(history)
    return {
        "total_value": history[-1]["total_value"], 
        "invested_capital": max(0, invested_capital),
        "metrics": metrics
    }

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

@app.post("/api/cron/update-signals")
def update_signals(x_cron_secret: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Secure endpoint for periodic data updates via GitHub Actions"""
    expected_secret = os.getenv("CRON_SECRET")
    if not expected_secret or x_cron_secret != expected_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing cron secret"
        )
    
    try:
        vxn_updated = QuantService.update_vxn_history(db)
        mstr_seeded = QuantService.seed_mstr_corporate_actions(db)
        
        return {
            "status": "success", 
            "message": "VXN history updated and MSTR actions verified.",
            "vxn_updated": vxn_updated,
            "mstr_seeded": mstr_seeded
        }
    except Exception as e:
        print(f"Error in POST /api/cron/update-signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
