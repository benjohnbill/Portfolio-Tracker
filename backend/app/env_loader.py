from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_ROOT / ".env"


def load_backend_env(override: bool = False) -> None:
    if ENV_FILE.exists():
        load_dotenv(ENV_FILE, override=override, encoding="utf-8-sig")
