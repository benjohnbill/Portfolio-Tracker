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


from datetime import date as _date

from tests.fixtures.seeds import (
    seed_asset,
    seed_daily_price,
    seed_weekly_report,
    seed_weekly_snapshot,
    seed_decision,
)


def test_seed_asset_roundtrip(db_session):
    asset = seed_asset(db_session, symbol="QQQ")
    assert asset.id is not None
    assert asset.symbol == "QQQ"


def test_seed_daily_price_roundtrip(db_session):
    asset = seed_asset(db_session, symbol="SPY")
    px = seed_daily_price(db_session, asset=asset, price_date=_date(2026, 4, 17), close=512.3)
    assert px.asset_id == asset.id
    assert px.close == 512.3


def test_seed_weekly_report_roundtrip(db_session):
    report = seed_weekly_report(db_session, week_ending=_date(2026, 4, 17))
    assert report.week_ending == _date(2026, 4, 17)
    assert report.status == "final"


def test_seed_weekly_snapshot_with_comment(db_session):
    snap = seed_weekly_snapshot(
        db_session,
        snapshot_date=_date(2026, 4, 17),
        comment="QA seed comment",
    )
    assert snap.comment == "QA seed comment"
    assert snap.frozen_report == {"status": "final"}


def test_seed_decision_plan_c_fields(db_session):
    snap = seed_weekly_snapshot(db_session, snapshot_date=_date(2026, 4, 17))
    dec = seed_decision(
        db_session,
        snapshot=snap,
        confidence_vs_spy_riskadj=7,
        confidence_vs_cash=9,
        confidence_vs_spy_pure=5,
        expected_failure_mode="price_drop",
        trigger_threshold=0.05,
        invalidation="if SPY drops >5% in 2 weeks",
    )
    assert dec.confidence_vs_spy_riskadj == 7
    assert dec.confidence_vs_cash == 9
    assert dec.confidence_vs_spy_pure == 5
    assert dec.expected_failure_mode == "price_drop"
    assert dec.trigger_threshold == 0.05
    assert dec.invalidation == "if SPY drops >5% in 2 weeks"
