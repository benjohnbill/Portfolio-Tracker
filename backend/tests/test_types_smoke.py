"""Smoke tests for the C-track (sqlite) fixtures + JsonVariant round-trip."""

from __future__ import annotations

from datetime import date, datetime, timezone

from app.models import WeeklySnapshot


def test_sqlite_jsonvariant_roundtrip(db_session):
    """Inserting a WeeklySnapshot with a dict in frozen_report and re-reading
    it should yield the same dict — proving JsonVariant works on SQLite."""
    snap = WeeklySnapshot(
        snapshot_date=date(2026, 4, 17),
        created_at=datetime.now(timezone.utc),
        frozen_report={"status": "final", "score": 92, "buckets": [1, 2, 3]},
        snapshot_metadata={"generator": "test"},
    )
    db_session.add(snap)
    db_session.commit()

    fetched = (
        db_session.query(WeeklySnapshot)
        .filter_by(snapshot_date=date(2026, 4, 17))
        .one()
    )
    assert fetched.frozen_report == {
        "status": "final",
        "score": 92,
        "buckets": [1, 2, 3],
    }
    assert fetched.snapshot_metadata == {"generator": "test"}


def test_client_hits_health(client):
    """TestClient wired through the sqlite-backed get_db override returns
    200 on /health — proves dependency override is hooked up."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
