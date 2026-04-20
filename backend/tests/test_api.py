from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app
from app.models import WeeklySnapshot

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to Portfolio Tracker API"}

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_get_portfolio_history_mock():
    # Test getting history (should return mock data as DB is empty)
    response = client.get("/api/portfolio/history?period=1y")
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

    # Check data structure
    first_item = data[0]
    assert "date" in first_item
    assert "total_value" in first_item
    assert "daily_return" in first_item
    assert "benchmark_value" in first_item
    assert "alpha" in first_item

    # Check values logic (mock data always starts at 10M)
    assert first_item["total_value"] > 0


# ---------------------------------------------------------------------------
# Phase D Tier 1 — POST /api/v1/friday/decisions API-level tests
#
# These tests override the `get_db` dependency with an in-memory fake DB
# (same pattern as tests/test_friday_service.py) so they do not touch the real
# Supabase database. The fake DB pre-seeds one WeeklySnapshot row the tests
# can attach decisions to.
# ---------------------------------------------------------------------------


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows
        self._filters = []

    def filter(self, *conditions):
        self._filters.extend(conditions)
        return self

    def order_by(self, *_args):
        return self

    def all(self):
        return [row for row in self._rows if self._matches(row)]

    def first(self):
        rows = self.all()
        return rows[0] if rows else None

    def _matches(self, row):
        for condition in self._filters:
            left = getattr(condition, "left", None)
            right = getattr(condition, "right", None)
            operator = getattr(getattr(condition, "operator", None), "__name__", "")
            field = getattr(left, "name", None)
            value = getattr(right, "value", None)
            if operator == "eq" and field is not None and getattr(row, field) != value:
                return False
        return True


class _FakeDB:
    def __init__(self, snapshots=None, decisions=None):
        self.snapshots = snapshots or []
        self.decisions = decisions or []
        self._id_seq = 100

    def query(self, model):
        name = getattr(model, "__name__", str(model))
        if name == "WeeklySnapshot":
            return _FakeQuery(self.snapshots)
        if name == "WeeklyDecision":
            return _FakeQuery(self.decisions)
        return _FakeQuery([])

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            self._id_seq += 1
            obj.id = self._id_seq
        # WeeklyDecision is the only thing the decisions endpoint inserts.
        cls_name = obj.__class__.__name__
        if cls_name == "WeeklyDecision":
            self.decisions.append(obj)
        elif cls_name == "WeeklySnapshot":
            self.snapshots.append(obj)

    def commit(self):
        return None

    def refresh(self, obj):
        return obj

    def rollback(self):
        return None


@pytest.fixture
def seeded_snapshot():
    """Seed a WeeklySnapshot in a fake DB and return its id + a get_db override.

    Overrides FastAPI's `get_db` dependency for the duration of the test so
    POST /api/v1/friday/decisions talks to the in-memory fake instead of the
    real Supabase database.
    """
    snapshot = WeeklySnapshot(
        id=7,
        snapshot_date=date(2026, 4, 17),
        created_at=datetime.now(timezone.utc),
        frozen_report={"status": "final"},
        snapshot_metadata={},
    )
    fake = _FakeDB(snapshots=[snapshot])

    def _override_get_db():
        yield fake

    app.dependency_overrides[get_db] = _override_get_db
    try:
        yield {"id": snapshot.id, "db": fake}
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_post_friday_decision_accepts_three_confidence_scalars(seeded_snapshot):
    response = client.post(
        "/api/v1/friday/decisions",
        json={
            "snapshot_id": seeded_snapshot["id"],
            "decision_type": "rebalance",
            "asset_ticker": "QQQ",
            "note": "Trim",
            "confidence_vs_spy_riskadj": 8,
            "confidence_vs_cash": 7,
            "confidence_vs_spy_pure": 6,
            "invalidation": "Macro improves",
            "expected_failure_mode": "regime_shift",
            "trigger_threshold": 0.05,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["confidenceVsSpyRiskadj"] == 8
    assert body["confidenceVsCash"] == 7
    assert body["confidenceVsSpyPure"] == 6
    assert body["expectedFailureMode"] == "regime_shift"
    assert body["triggerThreshold"] == 0.05


def test_post_friday_decision_requires_confidence_vs_spy_riskadj(seeded_snapshot):
    response = client.post(
        "/api/v1/friday/decisions",
        json={
            "snapshot_id": seeded_snapshot["id"],
            "decision_type": "hold",
            "note": "Stay put",
        },
    )
    assert response.status_code == 422, response.text


def test_post_friday_snapshot_accepts_comment(seeded_snapshot, monkeypatch):
    # Different date to avoid colliding with the fixture's snapshot.
    from app.services.report_service import ReportService

    monkeypatch.setattr(
        ReportService,
        "build_weekly_report",
        lambda db, d: {
            "weekEnding": d.isoformat(),
            "generatedAt": "2026-04-10T00:00:00+00:00",
            "logicVersion": "weekly-report-v0",
            "status": "final",
            "dataFreshness": {"portfolioAsOf": d.isoformat(), "signalsAsOf": None, "macroKnownAsOf": None, "staleFlags": []},
            "portfolioSnapshot": {"totalValueKRW": 1_000_000, "investedCapitalKRW": 1_000_000, "metrics": {}, "allocation": [{"asset": "QQQ", "name": "QQQ", "weight": 1.0, "value": 1_000_000}], "targetDeviation": []},
            "macroSnapshot": {"overallState": "neutral", "buckets": [], "indicators": [], "knownAsOf": d.isoformat()},
            "signalsSnapshot": {},
            "score": {"total": 60, "fit": 20, "alignment": 20, "postureDiversification": 20, "bucketBreakdown": [], "positives": [], "negatives": []},
            "triggeredRules": [],
            "recommendation": {"stance": "hold", "actions": [], "rationale": []},
            "eventAnnotations": [],
            "userAction": None,
            "outcomeWindow": None,
            "notes": None,
            "llmSummary": None,
        },
    )

    response = client.post(
        "/api/v1/friday/snapshot",
        json={"snapshot_date": "2026-04-10", "comment": "지난 주와 비슷, 소폭 감소 지속 관찰."},
    )
    assert response.status_code == 200, response.json()
    body = response.json()
    assert body["comment"] == "지난 주와 비슷, 소폭 감소 지속 관찰."


def test_get_friday_briefing_empty_state(monkeypatch):
    response = client.get("/api/v1/friday/briefing")
    assert response.status_code == 200
    body = response.json()
    assert "regimeTransitions" in body
    assert "maturedOutcomes" in body
    assert "alertHistory" in body
    assert "lastSnapshotComment" in body


def test_get_friday_briefing_rejects_invalid_since_date():
    response = client.get("/api/v1/friday/briefing?since=not-a-date")
    assert response.status_code == 400


def test_get_friday_sleeve_history_returns_zeros_when_no_reports():
    response = client.get("/api/v1/friday/sleeve-history?weeks=4")
    assert response.status_code == 200
    body = response.json()
    for sleeve in ["NDX", "DBMF", "BRAZIL", "MSTR", "GLDM", "BONDS-CASH"]:
        assert body[sleeve] == [0, 0, 0, 0]


def test_get_friday_sleeve_history_rejects_out_of_range_weeks():
    response = client.get("/api/v1/friday/sleeve-history?weeks=0")
    assert response.status_code == 400
    response = client.get("/api/v1/friday/sleeve-history?weeks=53")
    assert response.status_code == 400


def test_update_signals_invokes_spy_delta_backfill(monkeypatch):
    import os
    from unittest.mock import MagicMock, patch

    monkeypatch.setenv("CRON_SECRET", "test-secret")

    with patch("app.main.PriceIngestionService"), \
         patch("app.main.PortfolioService"), \
         patch("app.main.QuantService") as MockQuant, \
         patch("app.main.AlgoService"), \
         patch("app.main.ReportService") as MockReport, \
         patch("app.main.AttributionService"), \
         patch("app.main.IntelligenceService") as MockIntel, \
         patch("app.main.NotificationService"), \
         patch("app.main.send_discord_message"), \
         patch("app.main.OutcomeEvaluatorService") as MockEval:

        MockQuant.update_vxn_history.return_value = True
        MockQuant.seed_mstr_corporate_actions.return_value = False
        MockReport.generate_weekly_report.return_value = {
            "portfolioSnapshot": {}, "score": {"total": 80}, "weekEnding": "2026-04-18"
        }
        MockIntel.evaluate_decision_outcomes.return_value = 0
        MockIntel.detect_regime_transitions.return_value = []
        MockEval.backfill_spy_deltas.return_value = {"processed": 2, "skipped_insufficient_data": 0, "errors": 0}

        response = client.post(
            "/api/cron/update-signals",
            headers={"x-cron-secret": "test-secret"},
        )

    assert response.status_code == 200
    MockEval.backfill_spy_deltas.assert_called_once()
