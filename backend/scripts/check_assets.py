from app.database import SessionLocal
from app.models import Asset

db = SessionLocal()
assets = db.query(Asset).all()
print("Available assets in DB:")
for a in assets:
    print(f"ID: {a.id}, Symbol: '{a.symbol}'")
db.close()
