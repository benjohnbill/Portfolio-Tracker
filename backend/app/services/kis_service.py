import os
import requests
from .kis_auth import KISAuth

class KISService:
    @staticmethod
    def get_brazil_bond_value():
        """
        Fetches the current KRW value of Brazil Bonds held in the KIS account.
        Specifically handles the Bond data structure returned by TR_ID CTRP6504R.
        """
        token = KISAuth.get_access_token()
        if not token:
            return 0.0

        path = "/uapi/overseas-stock/v1/trading/inquire-present-balance"
        url = f"{os.getenv('KIS_URL_BASE')}{path}"
        
        headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "authorization": f"Bearer {token}",
            "appkey": os.getenv("KIS_APP_KEY"),
            "appsecret": os.getenv("KIS_APP_SECRET"),
            "tr_id": "CTRP6504R" # Fixed to Settled Balance TR_ID which contains bonds
        }
        
        params = {
            "CANO": os.getenv("KIS_CANO"),
            "ACNT_PRDT_CD": os.getenv("KIS_ACNT_PRDT_CD"),
            "WCRC_FRCR_DVSN_CD": "02",
            "NATN_CD": "000", # Brazil bonds might be in US/Overseas clearing
            "TR_MKET_CD": "00",
            "INQR_DVSN_CD": "00"
        }
        
        try:
            res = requests.get(url, headers=headers, params=params)
            data = res.json()
            
            total_brazil_value_krw = 0.0
            
            if data.get("rt_cd") == "0":
                output1 = data.get("output1", [])
                for item in output1:
                    name = item.get("prdt_name", "") or ""
                    
                    # Target specific Brazil NTNF bonds
                    if "NTNF" in name.upper() or "브라질" in name or "BNTNF" in name.upper():
                        # frcr_evlu_amt2: Foreign currency evaluation amount
                        # bass_exrt: Base exchange rate
                        eval_amt_foreign = float(item.get("frcr_evlu_amt2", "0"))
                        exchange_rate = float(item.get("bass_exrt", "1"))
                        
                        # Calculate final KRW value
                        item_krw_val = eval_amt_foreign * exchange_rate
                        total_brazil_value_krw += item_krw_val
                        print(f"[KIS] Found Brazil Bond: {name} | KRW Value: ₩{item_krw_val:,.0f}")
                
                return total_brazil_value_krw
            else:
                print(f"[KIS] API Error: {data.get('msg1')}")
                return 0.0
        except Exception as e:
            print(f"[KIS] Request Exception: {e}")
            return 0.0
