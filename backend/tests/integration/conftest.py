"""Session-scoped PostgreSQL container + metadata create_all — D track.

The migration chain was built against an existing database (initial migration is a
no-op), so we use Base.metadata.create_all() for schema creation and then
`alembic stamp head` to register the current revision. This lets test_migrations.py
do a downgrade/upgrade roundtrip against the last migration without replaying the
full broken chain.
"""

from __future__ import annotations

import os

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from testcontainers.postgres import PostgresContainer

import app.models  # noqa: F401 — ensure all models are registered on Base.metadata
from app.database import Base, get_db
from app.main import app as fastapi_app


@pytest.fixture(scope="session")
def pg_container():
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg


@pytest.fixture(scope="session")
def pg_url(pg_container: PostgresContainer) -> str:
    return pg_container.get_connection_url()


@pytest.fixture(scope="session")
def pg_engine(pg_url: str):
    engine = create_engine(pg_url)
    Base.metadata.create_all(engine)

    # Stamp alembic_version so downgrade/upgrade roundtrips work in test_migrations.py.
    prior = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = pg_url
    try:
        alembic_cfg = Config("alembic.ini")
        command.stamp(alembic_cfg, "head")
    finally:
        if prior is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = prior

    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def pg_session(pg_engine) -> Session:
    SessionLocal = sessionmaker(bind=pg_engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        with pg_engine.begin() as conn:
            conn.exec_driver_sql(
                "DO $$ DECLARE r RECORD; "
                "BEGIN "
                "  FOR r IN (SELECT tablename FROM pg_tables "
                "            WHERE schemaname = current_schema() "
                "              AND tablename <> 'alembic_version') LOOP "
                "    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE'; "
                "  END LOOP; "
                "END $$;"
            )


@pytest.fixture
def pg_client(pg_session):
    def _override_get_db():
        try:
            yield pg_session
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    try:
        yield TestClient(fastapi_app)
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)
