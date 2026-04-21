# backend/tests/test_slippage.py
"""C1 Slippage Log — service + API tests (C-track, SQLite)."""
from datetime import date, datetime, timezone

import pytest

from app.models import ExecutionSlippage, WeeklyDecision, WeeklySnapshot
from app.services.friday_service import DecisionNotFoundError, FridayService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_snapshot(db_session):
    snap = WeeklySnapshot(
        snapshot_date=date(2026, 4, 18),
        created_at=datetime.now(timezone.utc),
        frozen_report={"score": {"total": 65}, "weekEnding": "2026-04-18", "status": "final"},
        snapshot_metadata={"coverage": {}, "partial": False, "errors": {}},
    )
    db_session.add(snap)
    db_session.commit()
    db_session.refresh(snap)
    return snap


def _seed_decision(db_session, snapshot_id):
    dec = WeeklyDecision(
        snapshot_id=snapshot_id,
        created_at=datetime.now(timezone.utc),
        decision_type="hold",
        note="Stay put",
        confidence_vs_spy_riskadj=7,
    )
    db_session.add(dec)
    db_session.commit()
    db_session.refresh(dec)
    return dec


# ---------------------------------------------------------------------------
# Service unit tests
# ---------------------------------------------------------------------------

def test_add_slippage_creates_record(db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)

    result = FridayService.add_slippage(
        db_session,
        decision_id=dec.id,
        executed_at=date(2026, 4, 19),
        executed_price=500.25,
        executed_qty=10.0,
        notes="Filled in two tranches",
    )

    assert result["decisionId"] == dec.id
    assert result["executedAt"] == "2026-04-19"
    assert result["executedPrice"] == pytest.approx(500.25)
    assert result["executedQty"] == pytest.approx(10.0)
    assert result["notes"] == "Filled in two tranches"
    assert result["id"] is not None


def test_add_slippage_all_fields_optional(db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)

    result = FridayService.add_slippage(db_session, decision_id=dec.id)

    assert result["executedAt"] is None
    assert result["executedPrice"] is None
    assert result["executedQty"] is None
    assert result["notes"] is None


def test_add_slippage_raises_for_missing_decision(db_session):
    with pytest.raises(DecisionNotFoundError):
        FridayService.add_slippage(db_session, decision_id=99999)


def test_get_slippage_for_decision_empty(db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)

    result = FridayService.get_slippage_for_decision(db_session, dec.id)

    assert result == []


def test_get_slippage_for_decision_returns_all_entries(db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)
    FridayService.add_slippage(db_session, decision_id=dec.id, notes="first")
    FridayService.add_slippage(db_session, decision_id=dec.id, notes="second")

    result = FridayService.get_slippage_for_decision(db_session, dec.id)

    assert len(result) == 2
    assert result[0]["notes"] == "first"
    assert result[1]["notes"] == "second"


def test_serialize_decision_includes_slippage_entries(db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)
    FridayService.add_slippage(db_session, decision_id=dec.id, executed_price=123.45, notes="logged")

    db_session.refresh(dec)
    result = FridayService._serialize_decision(dec)

    assert len(result["slippageEntries"]) == 1
    assert result["slippageEntries"][0]["executedPrice"] == pytest.approx(123.45)


def test_get_snapshot_includes_decision_slippage(db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)
    FridayService.add_slippage(db_session, decision_id=dec.id, notes="partial fill")

    payload = FridayService.get_snapshot(db_session, date(2026, 4, 18))

    assert len(payload["decisions"]) == 1
    assert len(payload["decisions"][0]["slippageEntries"]) == 1
    assert payload["decisions"][0]["slippageEntries"][0]["notes"] == "partial fill"


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

def test_post_slippage_success(client, db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)

    res = client.post("/api/v1/friday/slippage", json={
        "decision_id": dec.id,
        "executed_at": "2026-04-19",
        "executed_price": 502.10,
        "executed_qty": 5.0,
        "notes": "Bought at open",
    })

    assert res.status_code == 200
    body = res.json()
    assert body["decisionId"] == dec.id
    assert body["executedAt"] == "2026-04-19"
    assert body["executedPrice"] == pytest.approx(502.10)


def test_post_slippage_minimal_body(client, db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)

    res = client.post("/api/v1/friday/slippage", json={"decision_id": dec.id})

    assert res.status_code == 200
    assert res.json()["executedAt"] is None


def test_post_slippage_404_for_missing_decision(client):
    res = client.post("/api/v1/friday/slippage", json={"decision_id": 99999})
    assert res.status_code == 404


def test_post_slippage_400_for_bad_date(client, db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)

    res = client.post("/api/v1/friday/slippage", json={
        "decision_id": dec.id,
        "executed_at": "19-April-2026",
    })

    assert res.status_code == 400
