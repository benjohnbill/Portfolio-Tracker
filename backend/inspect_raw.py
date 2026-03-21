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

print(f"--- Raw KIS API Structure ---")
print(f"Status Code: {data.get('rt_cd')}")
print(f"Keys in Response: {list(data.keys())}")

if 'output1' in data and data['output1']:
    print(f"\n--- Output1 (Items) Sample ---")
    item = data['output1'][0]
    # Print all non-empty values to find the bond
    for k, v in item.items():
        if v and v != '0' and v != '0.00':
            print(f"Field [{k}]: {v}")

if 'output2' in data:
    print(f"\n--- Output2 (Summary) Keys ---")
    print(list(data['output2'].keys()))
    # Looking for total evaluation in KRW
    for k in ['frcr_evlu_amt2', 'evlu_amt_smtl_amt', 'tot_evlu_pnl_amt']:
        if k in data['output2']:
            print(f"Summary Field [{k}]: Found")
