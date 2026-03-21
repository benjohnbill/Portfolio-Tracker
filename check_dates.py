import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv('backend/.env')
db_url = os.getenv('DATABASE_URL')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(db_url)
with engine.connect() as conn:
    res = conn.execute(text("SELECT MIN(date), MAX(date), COUNT(*) FROM transactions"))
    row = res.fetchone()
    print(f"Min Date: {row[0]}")
    print(f"Max Date: {row[1]}")
    print(f"Total Transactions: {row[2]}")
