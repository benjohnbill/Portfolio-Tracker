import traceback
from app.database import SessionLocal
from app.models import Asset
from app.services.portfolio_service import PortfolioService

db = SessionLocal()
try:
    print('Testing get_equity_curve...')
    history = PortfolioService.get_equity_curve(db, '1m')
    print('Success:', len(history), 'records')
except Exception as e:
    print('ERROR OCCURRED:')
    traceback.print_exc()
finally:
    db.close()
