import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv('backend/.env')
db_url = os.getenv('DATABASE_URL')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(db_url)
with engine.connect() as conn:
    print("--- portfolio_snapshots structure ---")
    res = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'portfolio_snapshots'"))
    for row in res:
        print(row)
    print("\n--- Constraints ---")
    res = conn.execute(text("SELECT conname, contype FROM pg_constraint WHERE conrelid = 'portfolio_snapshots'::regclass"))
    for row in res:
        print(row)
