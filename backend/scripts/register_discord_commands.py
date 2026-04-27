import os
import sys
import json
import requests
from pathlib import Path

# Add backend to path to import env_loader
backend_root = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_root))

from app.env_loader import load_backend_env

def register_commands():
    load_backend_env()
    
    app_id = os.getenv("DISCORD_APP_ID")
    bot_token = os.getenv("DISCORD_BOT_TOKEN")
    
    if not app_id or not bot_token:
        print("❌ Error: DISCORD_APP_ID or DISCORD_BOT_TOKEN is missing in .env")
        return

    url = f"https://discord.com/api/v10/applications/{app_id}/commands"
    
    headers = {
        "Authorization": f"Bot {bot_token}",
        "Content-Type": "application/json"
    }
    
    commands = [
        {
            "name": "comment",
            "type": 1, # CHAT_INPUT
            "description": "이번 주 포트폴리오 스냅샷에 코멘트를 남깁니다.",
        }
    ]
    
    print(f"Registering commands to {url}...")
    response = requests.put(url, headers=headers, json=commands)
    
    if response.status_code == 200:
        print("✅ Successfully registered slash commands!")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    else:
        print(f"❌ Failed to register commands: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    register_commands()
