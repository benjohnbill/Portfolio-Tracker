import os
import sys

# Add the backend directory to sys.path to allow importing from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.database import SessionLocal
from app.services.algo_service import AlgoService
from app.services.quant_service import QuantService
import json

def test_algo():
    db = SessionLocal()
    try:
        print("--- Initializing Data ---")
        # Ensure we have some data for VXN and MSTR
        QuantService.update_vxn_history(db)
        QuantService.seed_mstr_corporate_actions(db)
        
        print("\n--- Generating Algo Report ---")
        report = AlgoService.get_action_report(db)
        
        print("\nSignals:")
        # Pretty print signals (ignoring large history if any)
        signals_summary = {k: v for k, v in report['signals'].items() if k != 'timestamp'}
        print(json.dumps(signals_summary, indent=2))
        
        print("\nCurrent Account Status (Holdings):")
        print(json.dumps(report['account_status'], indent=2))
        
        print("\nRecommended Actions:")
        if not report['actions']:
            print("No actions recommended at this time.")
        for action in report['actions']:
            print(f"- [{action['asset']}] {action['action']}")
            print(f"  Reason: {action['reason']}")
            
    except Exception as e:
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_algo()
