import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta
import random
from pydantic import BaseModel
from typing import Optional

from .database import SessionLocal, engine, Base
from .models import PortfolioSnapshot, Asset, DailyPrice, Transaction
from .services.price_service import PriceService
from .services.portfolio_service import PortfolioService
from .services.macro_service import MacroService
from .services.stress_service import StressService

app = FastAPI(title="Portfolio Tracker API", version="0.1.0")

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

@app.on_event("startup")
def on_startup():
    """Seed database with initial assets and sample transactions if empty."""
    db = SessionLocal()
    try:
        if db.query(Asset).count() == 0:
            print("Seeding initial assets and sample transactions...")
            assets = [
                Asset(symbol="QQQ", name="Invesco QQQ Trust", code="QQQ", source="US"),
                Asset(symbol="SPY", name="SPDR S&P 500 ETF Trust", code="SPY", source="US"),
                Asset(symbol="TLT", name="iShares 20+ Year Treasury Bond ETF", code="TLT", source="US"),
                Asset(symbol="GLDM", name="SPDR Gold MiniShares Trust", code="GLDM", source="US"),
                Asset(symbol="AAPL", name="Apple Inc.", code="AAPL", source="US"),
                Asset(symbol="005930", name="Samsung Electronics", code="005930", source="KR"),
                Asset(symbol="379810", name="KODEX Nasdaq100 TR", code="379810", source="KR"),
            ]
            db.add_all(assets)
            db.commit()
            
            # Refresh asset IDs
            qqq = db.query(Asset).filter(Asset.symbol == "QQQ").first()
            samsung = db.query(Asset).filter(Asset.symbol == "005930").first()
            spy = db.query(Asset).filter(Asset.symbol == "SPY").first()
            
            # Add sample transactions for immediate visualization
            t1 = Transaction(
                asset_id=qqq.id,
                type="BUY",
                quantity=20,
                price=380.0,
                total_amount=7600.0,
                date=datetime.now() - timedelta(days=180)
            )
            t2 = Transaction(
                asset_id=samsung.id,
                type="BUY",
                quantity=100,
                price=72000.0,
                total_amount=7200000.0,
                date=datetime.now() - timedelta(days=90)
            )
            t3 = Transaction(
                asset_id=spy.id,
                type="BUY",
                quantity=10,
                price=480.0,
                total_amount=4800.0,
                date=datetime.now() - timedelta(days=30)
            )
            db.add_all([t1, t2, t3])
            db.commit()
            print("Database seeded successfully.")
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

# Request Models
class TransactionCreate(BaseModel):
    asset_id: int
    type: str # BUY, SELL
    quantity: float
    price: float
    date: Optional[date] = None

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)

# Also allow all origins temporarily for Render MVP testing if explicitly set
if os.getenv("ALLOW_ALL_ORIGINS") == "true":
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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
    """Creates a new trade record"""
    new_tx = Transaction(
        asset_id=tx.asset_id,
        type=tx.type,
        quantity=tx.quantity,
        price=tx.price,
        total_amount=tx.quantity * tx.price,
        date=tx.date or date.today()
    )
    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)
    return new_tx

from .services.exchange_service import ExchangeService

@app.get("/api/portfolio/allocation")
def get_portfolio_allocation(db: Session = Depends(get_db)):
    """Calculates current holdings and weights in KRW"""
    
    # 1. Calculate holdings from transactions
    txs = db.query(Transaction).all()
    holdings = {} # {asset_id: quantity}
    
    for t in txs:
        if t.asset_id not in holdings:
            holdings[t.asset_id] = 0
        
        if t.type == "BUY":
            holdings[t.asset_id] += t.quantity
        elif t.type == "SELL":
            holdings[t.asset_id] -= t.quantity

    # Filter out zero holdings
    active_holdings = {k: v for k, v in holdings.items() if v > 0.0001}
    
    if not active_holdings:
        return []

    # 2. Get latest prices and FX rate
    current_fx = ExchangeService.get_current_rate()
    
    result = []
    total_value = 0
    
    for asset_id, qty in active_holdings.items():
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        
        # Fetch real price from PriceService
        current_price = PriceService.get_current_price(
            symbol=asset.code if asset.source == "KR" else asset.symbol,
            source=asset.source
        )
        
        # Fallback to last transaction price if real-time fetch fails
        if current_price == 0:
            last_tx = db.query(Transaction).filter(Transaction.asset_id == asset_id).order_by(Transaction.date.desc()).first()
            current_price = last_tx.price if last_tx else 100.0 
        
        # Calculate value in KRW
        value_krw = 0
        if asset.source == "US":
            value_krw = qty * current_price * current_fx
        else:
            value_krw = qty * current_price
            
        total_value += value_krw
        
        result.append({
            "asset": asset.symbol,
            "name": asset.name,
            "quantity": qty,
            "price": current_price, # Original currency price
            "value": value_krw,      # Always KRW
            "weight": 0,
            "source": asset.source
        })

    # 3. Calculate weights
    for item in result:
        item["weight"] = item["value"] / total_value if total_value > 0 else 0
        
    return sorted(result, key=lambda x: x["value"], reverse=True)

@app.get("/api/portfolio/history")
def get_portfolio_history(period: str = "1y", db: Session = Depends(get_db)):
    """
    Returns portfolio value history for charts based on real transactions.
    Period: 1m, 3m, 6m, 1y, all
    """
    history = PortfolioService.get_equity_curve(db, period)

    # If no real data, fallback to mock data for development
    if not history:
        today = date.today()
        start_date = today - timedelta(days=365)
        return generate_mock_history(start_date, today)

    return history

@app.get("/api/portfolio/summary")
def get_portfolio_summary(db: Session = Depends(get_db)):
    """
    Returns high-level performance metrics (CAGR, MDD, Sharpe).
    """
    history = PortfolioService.get_equity_curve(db, period="all")
    if not history:
        # Return default/empty metrics if no data
        return {
            "total_value": 0,
            "metrics": {
                "total_return": 0,
                "cagr": 0,
                "mdd": 0,
                "volatility": 0,
                "sharpe_ratio": 0
            }
        }
    
    metrics = PortfolioService.calculate_metrics(history)
    latest_value = history[-1]["total_value"]

    return {
        "total_value": latest_value,
        "metrics": metrics
    }

@app.get("/api/macro-vitals")
def get_macro_vitals():
    """
    Returns Net Liquidity and Real Yield data from FRED.
    """
    data = MacroService.get_macro_vitals()
    if not data:
        return {"status": "loading", "message": "Fetching macro data..."}
    return data

@app.get("/api/stress-test")
def get_stress_test(db: Session = Depends(get_db)):
    """
    Simulates portfolio performance during historical crises (2020, 2022).
    """
    # 1. Calculate current weights (Reuse logic from allocation endpoint)
    txs = db.query(Transaction).all()
    holdings = {}
    for t in txs:
        holdings[t.asset_id] = holdings.get(t.asset_id, 0) + (t.quantity if t.type == "BUY" else -t.quantity)
    
    active_holdings = {aid: qty for aid, qty in holdings.items() if qty > 0.0001}
    
    if not active_holdings:
        return []

    # Calculate total value to determine weights
    total_value = 0
    asset_values = {} # {symbol: value}
    
    for aid, qty in active_holdings.items():
        asset = db.query(Asset).filter(Asset.id == aid).first()
        # Get simplified current price (mock/last tx for speed)
        last_tx = db.query(Transaction).filter(Transaction.asset_id == aid).order_by(Transaction.date.desc()).first()
        price = last_tx.price if last_tx else 100.0
        
        val = qty * price
        asset_values[asset.symbol] = val
        total_value += val
    
    if total_value == 0:
        return []

    # 2. Prepare weights dict for simulation
    weights = {sym: val / total_value for sym, val in asset_values.items()}
    
    # 3. Run Simulation
    return StressService.run_simulation(weights)

def generate_mock_history(start_date, end_date):
    """Generates mock data for frontend testing"""
    mock_data = []
    current_date = start_date
    value = 10000000 # 10 million KRW start
    
    while current_date <= end_date:
        # Random daily fluctuation (-1% to +1.2%)
        change_pct = random.uniform(-0.01, 0.012)
        value = value * (1 + change_pct)
        
        mock_data.append({
            "date": current_date.isoformat(),
            "total_value": int(value),
            "cash": 500000,
            "invested": int(value - 500000),
            "daily_return": change_pct * 100
        })
        current_date += timedelta(days=1)
    
    return mock_data
