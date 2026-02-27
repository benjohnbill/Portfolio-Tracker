import json
import os
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import Asset, DailyPrice, Transaction

# Create tables
Base.metadata.create_all(bind=engine)

def seed_assets(db: Session):
    # Load asset map from legacy
    json_path = os.path.join(os.path.dirname(__file__), "../../legacy/backend/asset_map.json")
    
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        print(f"Loaded asset_map.json with {len(data)} items.")
        
        assets = []
        for symbol, info in data.items():
            # Check if exists
            existing = db.query(Asset).filter(Asset.symbol == symbol).first()
            if not existing:
                asset = Asset(
                    symbol=symbol,
                    code=info.get("symbol"), 
                    name=info.get("name"),
                    source=info.get("source")
                )
                db.add(asset)
                assets.append(asset)
                print(f"Added asset: {symbol}")
            else:
                assets.append(existing)
                print(f"Skipped existing asset: {symbol}")
        
        db.commit()
        return assets
        
    except FileNotFoundError:
        print(f"Warning: {json_path} not found. Skipping asset seeding.")
        return []
    except Exception as e:
        print(f"Error seeding assets: {e}")
        return []

def seed_dummy_transactions(db: Session, assets):
    if not assets:
        print("No assets found, skipping transaction seeding.")
        return

    # Check if transactions exist
    count = db.query(Transaction).count()
    if count > 0:
        print("Transactions already exist, skipping seeding.")
        return

    print("Seeding dummy transactions...")
    
    # QQQ Buy
    qqq = next((a for a in assets if a.symbol == "QQQ"), None)
    if qqq:
        tx1 = Transaction(
            date=datetime.now() - timedelta(days=30),
            asset_id=qqq.id,
            type="BUY",
            quantity=100,
            price=440.5, # USD
            total_amount=44050
        )
        db.add(tx1)

    # SPY Buy (Using Asset Map Key, assuming SPY exists)
    spy = next((a for a in assets if a.symbol == "SPY"), None)
    if spy:
        tx2 = Transaction(
            date=datetime.now() - timedelta(days=20),
            asset_id=spy.id,
            type="BUY",
            quantity=50,
            price=510.2, # USD
            total_amount=25510
        )
        db.add(tx2)
        
    db.commit()
    print("Dummy transactions seeded.")

def main():
    db = SessionLocal()
    try:
        assets = seed_assets(db)
        seed_dummy_transactions(db, assets)
    finally:
        db.close()

if __name__ == "__main__":
    main()
