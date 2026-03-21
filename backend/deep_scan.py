import os
import requests
import json
from app.services.kis_auth import KISAuth

token = KISAuth.get_access_token()
url = f"{os.getenv('KIS_URL_BASE')}/uapi/overseas-stock/v1/trading/inquire-present-balance"
headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    'authorization': f'Bearer {token}',
    'appkey': os.getenv('KIS_APP_KEY'),
    'appsecret': os.getenv('KIS_APP_SECRET'),
    'tr_id': 'TTTC8434R'
}
params = {
    'CANO': os.getenv('KIS_CANO'),
    'ACNT_PRDT_CD': os.getenv('KIS_ACNT_PRDT_CD'),
    'WCRC_FRCR_DVSN_CD': '02',
    'NATN_CD': '000',
    'TR_MKET_CD': '00',
    'INQR_DVSN_CD': '00'
}
res = requests.get(url, headers=headers, params=params)
data = res.json()

print("--- Deep Scanning All Response Fields ---")
def find_brazil(obj, path="root"):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if "브라질" in str(v) or "Brazil" in str(v).upper():
                print(f"FOUND at [{path}.{k}]: {v}")
            find_brazil(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            find_brazil(item, f"{path}[{i}]")

find_brazil(data)
print("Deep Scan Finished.")
