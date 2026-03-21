import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.append(str(Path(__file__).resolve().parent))

from app.database import SessionLocal
from app.services.ingestion_service import PriceIngestionService

def main():
    print("Starting Price Ingestion...")
    db = SessionLocal()
    try:
        PriceIngestionService.update_raw_prices(db)
        print("Raw prices updated successfully.")
        
        PriceIngestionService.generate_portfolio_snapshots(db)
        print("Portfolio snapshots generated successfully.")
        
        print("Ingestion script completed successfully.")
    except Exception as e:
        print(f"Ingestion script failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
