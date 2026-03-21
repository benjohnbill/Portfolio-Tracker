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
    'tr_id': 'CTRP6504R'
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

if data.get('rt_cd') == '0' and data.get('output1'):
    item = data['output1'][0]
    print("--- Detailed Bond Data Fields ---")
    for k, v in item.items():
        if v and v != '0' and v != '0.00' and v != '0.00000000':
            # Hide sensitive values but show field names and format
            print(f"Field [{k}]: (Value Present)")
