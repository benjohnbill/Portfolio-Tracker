import os
import traceback
from app.env_loader import load_backend_env
from app.services.kis_auth import KISAuth
from app.services.kis_service import KISService

load_backend_env()

print("--- KIS Auth Test ---")
token = KISAuth.get_access_token()
if token:
    print("SUCCESS: Token acquired!")
    
    print("\n--- KIS Brazil Bond Balance Test ---")
    try:
        val = KISService.get_brazil_bond_value()
        print(f"SUCCESS: Brazil Bond Value = {val}")
    except Exception as e:
        print(f"FAILED: Service error")
        traceback.print_exc()
else:
    print("FAILED: Could not get access token. Check your App Key/Secret.")
