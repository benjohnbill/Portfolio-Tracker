import csv
import os
import sys
from datetime import datetime

# Add the project root to the python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models import Transaction, Asset

def import_transactions_from_csv(csv_path: str):
    if not os.path.exists(csv_path):
        print(f"Error: File not found at {csv_path}")
        return

    db = SessionLocal()
    try:
        existing_assets = {a.symbol: a for a in db.query(Asset).all()}
        transactions_to_add = []
        
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(filter(lambda row: not row.startswith('#'), f))
            
            for row in reader:
                symbol = row['symbol'].strip().upper()
                tx_type = row['type'].strip().upper()
                quantity = float(row['quantity'])
                price = float(row['price'])
                
                # Parse date or default to today
                date_str = row['date'].strip()
                tx_date = datetime.strptime(date_str, '%Y-%m-%d') if date_str else datetime.now()

                # 1. Create asset if it doesn't exist
                if symbol not in existing_assets:
                    print(f"New asset detected. Adding to DB: {symbol}")
                    new_asset = Asset(
                        symbol=symbol,
                        code=symbol,
                        name=symbol,
                        source="US" # Defaulting to US, can be edited later
                    )
                    db.add(new_asset)
                    db.commit()
                    db.refresh(new_asset)
                    existing_assets[symbol] = new_asset
                
                asset_obj = existing_assets[symbol]
                
                # 2. Prepare transaction
                tx = Transaction(
                    asset_id=asset_obj.id,
                    type=tx_type,
                    quantity=quantity,
                    price=price,
                    total_amount=quantity * price,
                    date=tx_date
                )
                transactions_to_add.append(tx)
                print(f"Prepared: {tx_type} {quantity} shares of {symbol} at ${price} on {date_str}")
        
        if transactions_to_add:
            db.add_all(transactions_to_add)
            db.commit()
            print(f"\nSuccess! {len(transactions_to_add)} transactions appended to your portfolio.")
        else:
            print("\nNo valid transactions found in CSV.")

    except Exception as e:
        print(f"Failed to import CSV: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # You can change this path when running the script
    CSV_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'updates.csv')
    import_transactions_from_csv(CSV_FILE)
