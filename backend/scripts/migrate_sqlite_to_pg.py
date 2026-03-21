import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Ensure the backend directory is in the python path
backend_dir = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_dir))

from app.models import Asset, Transaction, AccountType

def migrate_data():
    # Load environment variables
    load_dotenv(backend_dir / ".env")
    
    # SQLite Engine
    # Note: relative path needs to be from backend_dir
    sqlite_db_path = backend_dir / "data" / "portfolio.db"
    sqlite_url = f"sqlite:///{sqlite_db_path.resolve().as_posix()}"
    sqlite_engine = create_engine(sqlite_url)
    SqliteSession = sessionmaker(bind=sqlite_engine)
    sqlite_session = SqliteSession()

    # PostgreSQL Engine
    pg_url = os.getenv("DATABASE_URL")
    if not pg_url:
        print("Error: DATABASE_URL not found in environment")
        return

    pg_engine = create_engine(pg_url)
    PgSession = sessionmaker(bind=pg_engine)
    pg_session = PgSession()

    try:
        # Start transaction
        pg_session.begin()
        
        # 1. Map existing PG assets
        print("Mapping existing PG assets...")
        existing_pg_assets = pg_session.query(Asset).all()
        pg_symbol_to_id = {a.symbol: a.id for a in existing_pg_assets}
        
        # 2. Migrate Assets
        print("Reading assets from SQLite...")
        # Use raw SQL because SQLite doesn't have account_type column
        sqlite_assets = sqlite_session.execute(text("SELECT id, symbol, code, name, source FROM assets")).fetchall()
        
        asset_id_map = {} # {old_id: new_id}
        
        for old_asset in sqlite_assets:
            # old_asset is a Row object (id, symbol, code, name, source)
            old_id = old_asset[0]
            symbol = old_asset[1]
            
            if symbol in pg_symbol_to_id:
                asset_id_map[old_id] = pg_symbol_to_id[symbol]
                print(f"Mapped existing asset {symbol} to PG ID {pg_symbol_to_id[symbol]}")
            else:
                new_asset = Asset(
                    symbol=symbol,
                    code=old_asset[2],
                    name=old_asset[3],
                    source=old_asset[4],
                    account_type=AccountType.OVERSEAS # Default as per instructions
                )
                pg_session.add(new_asset)
                pg_session.flush() # Populate the new_asset.id
                asset_id_map[old_id] = new_asset.id
                print(f"Inserted new asset {symbol} with PG ID {new_asset.id}")
            
        print(f"Migrated {len(sqlite_assets)} assets.")

        # 3. Migrate Transactions
        print("Reading transactions from SQLite...")
        # Use raw SQL because SQLite doesn't have account_type column
        sqlite_transactions = sqlite_session.execute(text("SELECT id, date, asset_id, type, quantity, price, total_amount FROM transactions")).fetchall()
        
        for old_tx in sqlite_transactions:
            # old_tx is a Row object (id, date, asset_id, type, quantity, price, total_amount)
            old_asset_id = old_tx[2]
            if old_asset_id not in asset_id_map:
                print(f"Warning: Transaction {old_tx[0]} has unknown asset_id {old_asset_id}. Skipping.")
                continue
                
            new_tx = Transaction(
                date=old_tx[1],
                asset_id=asset_id_map[old_asset_id],
                type=old_tx[3],
                quantity=old_tx[4],
                price=old_tx[5],
                total_amount=old_tx[6],
                account_type=AccountType.OVERSEAS # Default as per instructions
            )
            pg_session.add(new_tx)
            
        print(f"Migrated {len(sqlite_transactions)} transactions.")

        # Commit PG transaction
        pg_session.commit()
        print("Successfully committed all changes to PostgreSQL.")

    except Exception as e:
        pg_session.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        sqlite_session.close()
        pg_session.close()

if __name__ == "__main__":
    migrate_data()
