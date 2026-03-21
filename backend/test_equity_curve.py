from app.database import SessionLocal
from app.services.portfolio_service import PortfolioService
import json

db = SessionLocal()
try:
    print("Fetching equity curve...")
    history = PortfolioService.get_equity_curve(db, period="all")
    print(f"History length: {len(history)}")
    if history:
        print("Latest entry:")
        print(json.dumps(history[-1], indent=2))
        
    from app.services.portfolio_service import PortfolioService
    metrics = PortfolioService.calculate_metrics(history)
    print("\nMetrics:")
    print(json.dumps(metrics, indent=2))
finally:
    db.close()
