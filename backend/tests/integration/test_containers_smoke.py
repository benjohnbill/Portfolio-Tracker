"""Smoke test — PostgreSQL container boots, Alembic runs, JsonVariant round-trips."""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from app.models import WeeklySnapshot


@pytest.mark.integration
def test_postgres_jsonvariant_roundtrip(pg_session):
    snap = WeeklySnapshot(
        snapshot_date=date(2026, 4, 17),
        created_at=datetime.now(timezone.utc),
        frozen_report={"status": "final", "score": 92},
        snapshot_metadata={"src": "integration-smoke"},
    )
    pg_session.add(snap)
    pg_session.commit()

    fetched = (
        pg_session.query(WeeklySnapshot)
        .filter_by(snapshot_date=date(2026, 4, 17))
        .one()
    )
    assert fetched.frozen_report == {"status": "final", "score": 92}
    assert fetched.snapshot_metadata == {"src": "integration-smoke"}


@pytest.mark.integration
def test_pg_client_health(pg_client):
    r = pg_client.get("/health")
    assert r.status_code == 200
