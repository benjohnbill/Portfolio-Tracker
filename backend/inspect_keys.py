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
if data.get('rt_cd') == '0' and data.get('output1'):
    first_item = data['output1'][0]
    print(f'Available Keys: {list(first_item.keys())}')
    # Look for value fields
    for k, v in first_item.items():
        if v and any(x in k.lower() for x in ['amt', 'val', 'name', 'pdno']):
            # Print key but hide real sensitive numbers
            print(f'Found Value Key: {k}')
