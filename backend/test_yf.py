import pandas as pd
from app.database import SessionLocal
from app.models import Asset, Transaction
from app.services.price_service import PriceService
from datetime import date, timedelta

db = SessionLocal()
transactions = db.query(Transaction).all()
asset_ids = list(set(t.asset_id for t in transactions))
assets = {a.id: a for a in db.query(Asset).filter(Asset.id.in_(asset_ids)).all()}
us_symbols = [a.symbol for a in assets.values() if a.source == 'US']
if 'SPY' not in us_symbols: us_symbols.append('SPY')

print(f"US Symbols: {us_symbols}")
df = PriceService.get_historical_prices_bulk(us_symbols, '2026-03-01', '2026-03-20')
for symbol in us_symbols:
    if symbol in df.columns:
        print(f"[{symbol}] Type: {type(df[symbol])}, Shape: {df[symbol].shape}")
        if isinstance(df[symbol], pd.DataFrame):
            print(f"It's a DataFrame! Columns: {df[symbol].columns}")
db.close()
