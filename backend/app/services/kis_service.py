import os
import requests
from datetime import date
from typing import Tuple, Dict
from .kis_auth import KISAuth

# Module-level cache for the current backend process. Keyed by
# (today's ISO date,). Day rollover invalidates automatically.
_KIS_BRAZIL_BOND_CACHE: Dict[Tuple[str], float] = {}

class KISService:
    @staticmethod
    def get_brazil_bond_value() -> float:
        """
        Fetches the current KRW value of Brazil Bonds held in the KIS account.
        Same-day calls reuse a process-local cache; day rollover invalidates.
        Failures (value <= 0) are not cached.
        """
        cache_key = (date.today().isoformat(),)
        if cache_key in _KIS_BRAZIL_BOND_CACHE:
            return _KIS_BRAZIL_BOND_CACHE[cache_key]

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
            "tr_id": "CTRP6504R"
        }

        params = {
            "CANO": os.getenv("KIS_CANO"),
            "ACNT_PRDT_CD": os.getenv("KIS_ACNT_PRDT_CD"),
            "WCRC_FRCR_DVSN_CD": "02",
            "NATN_CD": "000",
            "TR_MKET_CD": "00",
            "INQR_DVSN_CD": "00"
        }

        try:
            res = requests.get(url, headers=headers, params=params, timeout=5)
            data = res.json()

            total_brazil_value_krw = 0.0

            if data.get("rt_cd") == "0":
                output1 = data.get("output1", [])
                for item in output1:
                    name = item.get("prdt_name", "") or ""

                    if "NTNF" in name.upper() or "브라질" in name or "BNTNF" in name.upper():
                        eval_amt_foreign = float(item.get("frcr_evlu_amt2", "0"))
                        exchange_rate = float(item.get("bass_exrt", "1"))

                        item_krw_val = eval_amt_foreign * exchange_rate
                        total_brazil_value_krw += item_krw_val

                if total_brazil_value_krw > 0:  # don't cache failures
                    _KIS_BRAZIL_BOND_CACHE[cache_key] = total_brazil_value_krw
                return total_brazil_value_krw
            else:
                print(f"[KIS] API Error: {data.get('msg1')}")
                return 0.0
        except Exception as e:
            print(f"[KIS] Request Exception: {e}")
            return 0.0
