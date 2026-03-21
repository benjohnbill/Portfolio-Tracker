import os
import json
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

class KISAuth:
    _instance = None
    _token = None
    _expiry = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(KISAuth, cls).__new__(cls)
        return cls._instance

    @classmethod
    def get_access_token(cls):
        # 1. Check if we already have a valid token in memory
        if cls._token and cls._expiry and datetime.now() < cls._expiry:
            return cls._token

        # 2. If not, fetch a new one from KIS API
        url = f"{os.getenv('KIS_URL_BASE')}/oauth2/tokenP"
        app_key = os.getenv("KIS_APP_KEY", "").strip()
        app_secret = os.getenv("KIS_APP_SECRET", "").strip()

        if not app_key or not app_secret:
            print("[KIS] Error: KIS_APP_KEY or KIS_APP_SECRET is missing in .env")
            return None

        payload = {
            "grant_type": "client_credentials",
            "appkey": app_key,
            "appsecret": app_secret
        }
        
        try:
            headers = {"Content-Type": "application/json; charset=UTF-8"}
            # KIS API expects a JSON body with explicit headers
            res = requests.post(url, data=json.dumps(payload), headers=headers)
            data = res.json()
            
            if "access_token" in data:
                cls._token = data["access_token"]
                # Set expiry slightly earlier (e.g., 2 hours buffer) to be safe
                expires_in = data.get("expires_in", 86400)
                cls._expiry = datetime.now() + timedelta(seconds=int(expires_in) - 7200)
                print(f"[KIS] New Access Token acquired. Expires at: {cls._expiry}")
                return cls._token
            else:
                print(f"[KIS] Failed to get token: {data}")
                return None
        except Exception as e:
            print(f"[KIS] Auth Error: {e}")
            return None
