from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pathlib import Path
import os
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
DEFAULT_DB_PATH = BACKEND_ROOT / "data" / "portfolio.db"
ENV_FILE = BACKEND_ROOT / ".env"

if ENV_FILE.exists():
    load_dotenv(ENV_FILE)

configured_db_url = os.getenv("DATABASE_URL", "").strip()
if configured_db_url.startswith("sqlite:///"):
    sqlite_path = configured_db_url[len("sqlite:///"):]
    if sqlite_path.startswith("./") or sqlite_path.startswith(".\\"):
        normalized = (REPO_ROOT / sqlite_path[2:]).resolve()
        configured_db_url = f"sqlite:///{normalized.as_posix()}"

SQLALCHEMY_DATABASE_URL = configured_db_url or f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
