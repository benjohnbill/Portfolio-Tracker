"""Shared pytest fixtures — C track (in-memory SQLite).

Three fixtures exposed to every test under backend/tests/:

    sqlite_engine   — function-scoped fresh in-memory DB with all tables.
    db_session      — function-scoped SQLAlchemy Session bound to the engine.
    client          — function-scoped FastAPI TestClient with
                      get_db overridden to yield db_session.

Legacy tests (test_api.py, test_friday_service.py, …) still bake their own
_FakeDB and do not consume these fixtures — they are opt-in by argument name.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — ensure all mappers are registered before create_all
from app.database import Base, get_db
from app.main import app


@pytest.fixture
def sqlite_engine():
    """Fresh in-memory SQLite with all tables. One DB per test (function scope)."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def db_session(sqlite_engine) -> Session:
    SessionLocal = sessionmaker(
        bind=sqlite_engine, autoflush=False, autocommit=False
    )
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
