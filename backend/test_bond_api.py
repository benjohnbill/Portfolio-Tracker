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
    'tr_id': 'CTRP6504R' # Try different TR_ID for settled balance (often includes bonds)
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

print("--- Testing with TR_ID: CTRP6504R ---")
if data.get('rt_cd') == '0':
    output1 = data.get('output1', [])
    print(f"Found {len(output1)} items.")
    for item in output1:
        name = item.get('prdt_name', '') or item.get('ovrs_item_name', '')
        val = item.get('evlu_amt', '0') or item.get('frcr_evlu_amt2', '0')
        print(f"Asset: {name} | Value: {val}")
else:
    print(f"Error: {data.get('msg1')} ({data.get('msg_cd')})")
