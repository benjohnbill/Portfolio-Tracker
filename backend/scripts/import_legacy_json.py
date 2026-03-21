import json
import os
import sys
from datetime import datetime

# Add the project root to the python path so we can import 'app'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models import Transaction, Asset

def import_backup(json_path: str):
    if not os.path.exists(json_path):
        print(f"Error: Could not find file at {json_path}")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    export_date_str = data.get("exportDate", datetime.now().isoformat())
    export_date = datetime.fromisoformat(export_date_str.replace('Z', '+00:00')).replace(tzinfo=None)
    
    portfolio = data.get("portfolio", [])

    db = SessionLocal()
    try:
        print("Clearing existing transactions to prevent duplicates...")
        db.query(Transaction).delete()
        
        # We need to make sure all assets exist in our new DB.
        # If an asset from the JSON doesn't exist, we will create it.
        existing_assets = {a.symbol: a for a in db.query(Asset).all()}
        
        transactions_to_add = []
        
        for item in portfolio:
            symbol = item.get("ticker")
            shares = item.get("shares", 0)
            price = item.get("price", 0.0)
            name = item.get("name", symbol)
            
            if shares <= 0:
                continue
                
            # 1. Check if asset exists, if not, create it
            if symbol not in existing_assets:
                print(f"Adding new asset to DB: {symbol} ({name})")
                new_asset = Asset(
                    symbol=symbol,
                    code=symbol,  # Assuming US ticker for simplicity
                    name=name,
                    source="US" if item.get("currency") == "USD" else "KR"
                )
                db.add(new_asset)
                db.commit()
                db.refresh(new_asset)
                existing_assets[symbol] = new_asset
            
            asset_obj = existing_assets[symbol]
            
            # 2. Create the BUY transaction to represent this holding
            total_amount = shares * price
            
            # For simplicity, we register the initial buy at a past date (e.g., exactly 1 year before the export date)
            # so the equity curve has a long history to draw.
            # In a more complex script, we could parse the "history" array to get exact buy dates.
            buy_date = export_date.replace(year=export_date.year - 1)
            
            tx = Transaction(
                asset_id=asset_obj.id,
                type="BUY",
                quantity=shares,
                price=price,
                total_amount=total_amount,
                date=buy_date
            )
            transactions_to_add.append(tx)
            print(f"Prepared transaction: BUY {shares} shares of {symbol} at {price}")
            
        print(f"Inserting {len(transactions_to_add)} transactions into DB...")
        db.add_all(transactions_to_add)
        db.commit()
        print("Migration complete! Your historical portfolio is now live.")

    except Exception as e:
        print(f"Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # Point this to the user's actual backup file
    BACKUP_FILE = r"C:\Users\LG\OneDrive\바탕 화면\Life_System\03_Core_Resources\03_Finance\01_Portfolio_Tracker_Dev\03_Backup_Data\portfolio_backup_2025-12-14.json"
    import_backup(BACKUP_FILE)
