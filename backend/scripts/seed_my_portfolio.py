from app.database import SessionLocal
from app.models import Transaction, Asset
from datetime import datetime, timedelta

def run_seed():
    db = SessionLocal()
    try:
        print("Clearing existing transactions...")
        db.query(Transaction).delete()
        db.commit()

        # Get assets by their ID (1: QQQ, 3: TLT, 11: SPY)
        qqq = db.query(Asset).filter(Asset.id == 1).first()
        tlt = db.query(Asset).filter(Asset.id == 3).first()
        spy = db.query(Asset).filter(Asset.id == 11).first()

        my_trades = [
            # 1년 전 (2025년 3월) 매수
            Transaction(asset_id=qqq.id, type='BUY', quantity=50, price=300.0, total_amount=15000.0, date=datetime.now() - timedelta(days=365)),
            Transaction(asset_id=spy.id, type='BUY', quantity=20, price=400.0, total_amount=8000.0, date=datetime.now() - timedelta(days=365)),
            
            # 6개월 전 (2025년 9월) TLT 헤징 매수
            Transaction(asset_id=tlt.id, type='BUY', quantity=100, price=90.0, total_amount=9000.0, date=datetime.now() - timedelta(days=180)),
            
            # 1달 전 (최근) QQQ 부분 익절
            Transaction(asset_id=qqq.id, type='SELL', quantity=10, price=450.0, total_amount=4500.0, date=datetime.now() - timedelta(days=30)),
        ]

        print("Inserting new portfolio transactions...")
        db.add_all(my_trades)
        db.commit()
        print("Done! Portfolio successfully recreated.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    run_seed()
