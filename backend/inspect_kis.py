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
    'NATN_CD': '000', # Check ALL countries first to see where Brazil is
    'TR_MKET_CD': '00',
    'INQR_DVSN_CD': '00'
}
res = requests.get(url, headers=headers, params=params)
data = res.json()
if data.get('rt_cd') == '0':
    output1 = data.get('output1', [])
    print(f'Found {len(output1)} items in portfolio.')
    for i, item in enumerate(output1):
        # Print only symbol and country to protect value info
        print(f'Item {i+1}: Symbol={item.get("ovrs_pdno")}, Name={item.get("ovrs_item_name")}, Country={item.get("natn_cd")}')
else:
    print(f'Error: {data.get("msg1")}')
