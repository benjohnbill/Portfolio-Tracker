import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path('backend/.env')
if env_path.exists():
    load_dotenv(env_path)

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not found in environment")
    exit(1)

# Fix for Render/Heroku PostgreSQL URLs
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(db_url)

with engine.connect() as conn:
    print("--- Assets ---")
    result = conn.execute(text("SELECT * FROM assets WHERE symbol = 'BRAZIL_BOND'"))
    print(result.fetchall())

    print("\n--- Transactions ---")
    query = text("""
        SELECT a.symbol, t.type, t.quantity, t.price, t.date 
        FROM transactions t 
        JOIN assets a ON t.asset_id = a.id 
        WHERE a.symbol = 'BRAZIL_BOND'
    """)
    result = conn.execute(query)
    print(result.fetchall())
