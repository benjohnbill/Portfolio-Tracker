from app.database import SessionLocal
from app.models import Transaction, Asset
import pandas as pd

db = SessionLocal()
transactions = db.query(Transaction).order_by(Transaction.date).all()
asset_ids = list(set(t.asset_id for t in transactions))
assets = {a.id: a for a in db.query(Asset).filter(Asset.id.in_(asset_ids)).all()}

print('Assets in portfolio:')
for aid, a in assets.items():
    print(f' - ID: {aid}, Symbol: {a.symbol}, Source: {a.source}')

db.close()
