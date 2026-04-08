import os
from sqlalchemy import create_engine, text
from backend.app.env_loader import load_backend_env

# Load environment variables
load_backend_env()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not found in environment")
    exit(1)

# Fix for Render/Heroku PostgreSQL URLs
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(db_url)

with engine.connect() as conn:
    # 1. Get Asset ID for BRAZIL_BOND
    res = conn.execute(text("SELECT id FROM assets WHERE symbol = 'BRAZIL_BOND'"))
    row = res.fetchone()
    if not row:
        print("No asset found for BRAZIL_BOND")
        exit(1)
    asset_id = row[0]

    # 2. Get the latest transaction ID for this asset
    res = conn.execute(text("SELECT MAX(id) FROM transactions WHERE asset_id = :aid"), {"aid": asset_id})
    latest_id = res.fetchone()[0]

    if latest_id:
        # 3. Delete the latest one
        conn.execute(text("DELETE FROM transactions WHERE id = :tid"), {"tid": latest_id})
        conn.commit()
        print(f"Successfully deleted duplicate BRAZIL_BOND transaction (ID: {latest_id})")
    else:
        print("No transactions found for BRAZIL_BOND")
