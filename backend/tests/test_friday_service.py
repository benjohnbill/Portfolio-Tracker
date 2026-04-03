from datetime import date, datetime, timezone

import pytest

from app.models import WeeklyDecision, WeeklySnapshot
from app.services.friday_service import FridayService, SnapshotConflictError, SnapshotNotFoundError, SnapshotValidationError
from app.services.report_service import ReportService


class _Obj:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return list(self._rows)


class _FakeDB:
    def __init__(self, snapshots=None, decisions=None, annotations=None):
        self.snapshots = snapshots or []
        self.decisions = decisions or []
        self.annotations = annotations or []
        self._id_seq = 100

    def query(self, model):
        model_name = getattr(model, "__name__", str(model))
        if model_name == "WeeklySnapshot":
            return _FakeQuery(self.snapshots)
        if model_name == "WeeklyDecision":
            return _FakeQuery(self.decisions)
        if model_name == "EventAnnotation":
            return _FakeQuery(self.annotations)
        return _FakeQuery([])

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            self._id_seq += 1
            obj.id = self._id_seq
        if isinstance(obj, WeeklySnapshot):
            self.snapshots.append(obj)
        elif isinstance(obj, WeeklyDecision):
            self.decisions.append(obj)

    def commit(self):
        return None

    def refresh(self, obj):
        return obj

    def rollback(self):
        return None


def _report(score=65, total_value=1_500_000, regime="risk_on", rules=None, allocation=None, status="final"):
    return {
        "weekEnding": "2026-04-03",
        "generatedAt": "2026-04-03T00:00:00+00:00",
        "logicVersion": ReportService.LOGIC_VERSION,
        "status": status,
        "dataFreshness": {
            "portfolioAsOf": "2026-04-03",
            "portfolioValuation": {
                "asOf": "2026-04-03",
                "source": "live_equity_curve",
                "version": "portfolio-valuation-v1",
                "period": "all",
                "calculatedAt": "2026-04-03T00:00:00+00:00",
            },
            "signalsAsOf": "2026-04-03T00:00:00Z",
            "macroKnownAsOf": "2026-04-03",
            "staleFlags": [],
        },
        "portfolioSnapshot": {
            "totalValueKRW": total_value,
            "investedCapitalKRW": 1_000_000,
            "metrics": {},
            "allocation": allocation
            or [
                {"asset": "QQQ", "weight": 0.6},
                {"asset": "TLT", "weight": 0.4},
            ],
            "targetDeviation": [],
        },
        "macroSnapshot": {"overallState": regime, "knownAsOf": "2026-04-03"},
        "signalsSnapshot": {},
        "score": {
            "total": score,
            "fit": 30,
            "alignment": 20,
            "postureDiversification": 15,
            "bucketBreakdown": [],
            "positives": [],
            "negatives": [],
        },
        "triggeredRules": rules or [{"ruleId": "RULE_A"}],
        "recommendation": {"stance": "hold", "actions": [], "rationale": []},
        "eventAnnotations": [],
        "userAction": None,
        "outcomeWindow": None,
        "notes": None,
        "llmSummary": None,
    }


@pytest.fixture(autouse=True)
def _stub_table_creation(monkeypatch):
    monkeypatch.setattr(FridayService, "_ensure_tables", staticmethod(lambda: None))


def test_create_snapshot_persists_full_report(monkeypatch):
    db = _FakeDB()
    monkeypatch.setattr(ReportService, "build_weekly_report", staticmethod(lambda db, week_ending: _report()))

    created = FridayService.create_snapshot(db, date(2026, 4, 3))

    assert created["snapshotDate"] == "2026-04-03"
    assert created["frozenReport"]["score"]["total"] == 65
    assert created["metadata"]["partial"] is False
    assert len(db.snapshots) == 1


def test_create_snapshot_raises_conflict_for_duplicate(monkeypatch):
    existing = WeeklySnapshot(
        id=1,
        snapshot_date=date(2026, 4, 3),
        created_at=datetime.now(timezone.utc),
        frozen_report=_report(),
        snapshot_metadata={"coverage": {}},
    )
    db = _FakeDB(snapshots=[existing])
    monkeypatch.setattr(ReportService, "build_weekly_report", staticmethod(lambda db, week_ending: _report()))

    with pytest.raises(SnapshotConflictError):
        FridayService.create_snapshot(db, date(2026, 4, 3))


def test_create_snapshot_falls_back_to_partial_report(monkeypatch):
    db = _FakeDB()
    monkeypatch.setattr(ReportService, "build_weekly_report", staticmethod(lambda db, week_ending: (_ for _ in ()).throw(RuntimeError("macro down"))))
    monkeypatch.setattr(FridayService, "_build_partial_report", staticmethod(lambda db, snapshot_date, initial_error: (_report(status="partial"), {"portfolio": True, "macro": False, "signals": False, "annotations": True, "score": False, "recommendation": False}, {"macro": "down"})))

    created = FridayService.create_snapshot(db, date(2026, 4, 3))

    assert created["metadata"]["partial"] is True
    assert created["metadata"]["coverage"]["portfolio"] is True
    assert created["metadata"]["coverage"]["macro"] is False


def test_create_snapshot_rejects_when_portfolio_missing(monkeypatch):
    db = _FakeDB()
    monkeypatch.setattr(ReportService, "build_weekly_report", staticmethod(lambda db, week_ending: (_ for _ in ()).throw(RuntimeError("portfolio down"))))
    monkeypatch.setattr(FridayService, "_build_partial_report", staticmethod(lambda db, snapshot_date, initial_error: (_report(status="partial"), {"portfolio": False, "macro": False, "signals": False, "annotations": False, "score": False, "recommendation": False}, {"portfolio": "down"})))

    with pytest.raises(SnapshotValidationError):
        FridayService.create_snapshot(db, date(2026, 4, 3))


def test_list_snapshots_returns_reverse_chronological_order():
    older = WeeklySnapshot(id=1, snapshot_date=date(2026, 3, 28), created_at=datetime.now(timezone.utc), frozen_report=_report(score=50), snapshot_metadata={})
    newer = WeeklySnapshot(id=2, snapshot_date=date(2026, 4, 4), created_at=datetime.now(timezone.utc), frozen_report=_report(score=70), snapshot_metadata={})
    db = _FakeDB(snapshots=[older, newer])

    rows = FridayService.list_snapshots(db)

    assert [row["snapshotDate"] for row in rows] == ["2026-04-04", "2026-03-28"]
    assert rows[0]["score"] == 70


def test_get_snapshot_includes_decisions():
    snapshot = WeeklySnapshot(id=7, snapshot_date=date(2026, 4, 3), created_at=datetime.now(timezone.utc), frozen_report=_report(), snapshot_metadata={})
    decision = WeeklyDecision(id=9, snapshot_id=7, created_at=datetime.now(timezone.utc), decision_type="hold", asset_ticker="QQQ", note="Stay put", confidence=7, invalidation="Break trend")
    db = _FakeDB(snapshots=[snapshot], decisions=[decision])

    payload = FridayService.get_snapshot(db, date(2026, 4, 3))

    assert payload["id"] == 7
    assert payload["decisions"][0]["decisionType"] == "hold"


def test_get_snapshot_raises_when_missing():
    db = _FakeDB()

    with pytest.raises(SnapshotNotFoundError):
        FridayService.get_snapshot(db, date(2026, 4, 3))


def test_add_decision_persists_record():
    snapshot = WeeklySnapshot(id=7, snapshot_date=date(2026, 4, 3), created_at=datetime.now(timezone.utc), frozen_report=_report(), snapshot_metadata={})
    db = _FakeDB(snapshots=[snapshot])

    decision = FridayService.add_decision(db, snapshot_id=7, decision_type="rebalance", asset_ticker="QQQ", note="Trim exposure", confidence=8, invalidation="Macro improves")

    assert decision["snapshotId"] == 7
    assert decision["decisionType"] == "rebalance"
    assert len(db.decisions) == 1


def test_add_decision_rejects_missing_snapshot():
    db = _FakeDB()

    with pytest.raises(SnapshotNotFoundError):
        FridayService.add_decision(db, snapshot_id=99, decision_type="hold", note="none", confidence=5)


def test_add_decision_rejects_invalid_confidence():
    snapshot = WeeklySnapshot(id=7, snapshot_date=date(2026, 4, 3), created_at=datetime.now(timezone.utc), frozen_report=_report(), snapshot_metadata={})
    db = _FakeDB(snapshots=[snapshot])

    with pytest.raises(SnapshotValidationError):
        FridayService.add_decision(db, snapshot_id=7, decision_type="hold", note="none", confidence=11)


def test_compare_snapshots_returns_score_and_value_deltas():
    snapshot_a = WeeklySnapshot(id=1, snapshot_date=date(2026, 3, 28), created_at=datetime.now(timezone.utc), frozen_report=_report(score=50, total_value=1_000_000, regime="risk_off", rules=[{"ruleId": "RULE_A"}], allocation=[{"asset": "QQQ", "weight": 0.5}]), snapshot_metadata={})
    snapshot_b = WeeklySnapshot(id=2, snapshot_date=date(2026, 4, 4), created_at=datetime.now(timezone.utc), frozen_report=_report(score=75, total_value=1_300_000, regime="risk_on", rules=[{"ruleId": "RULE_B"}], allocation=[{"asset": "QQQ", "weight": 0.7}, {"asset": "TLT", "weight": 0.3}]), snapshot_metadata={})
    db = _FakeDB(snapshots=[snapshot_a, snapshot_b])

    comparison = FridayService.compare_snapshots(db, date(2026, 3, 28), date(2026, 4, 4))

    assert comparison["deltas"]["score_total"] == 25
    assert comparison["deltas"]["total_value"] == 300000
    assert comparison["deltas"]["regime_change"] == {"from": "risk_off", "to": "risk_on"}
    assert comparison["deltas"]["rules_added"] == ["RULE_B"]
    assert comparison["deltas"]["rules_removed"] == ["RULE_A"]


def test_compare_snapshots_reports_holdings_changes():
    snapshot_a = WeeklySnapshot(id=1, snapshot_date=date(2026, 3, 28), created_at=datetime.now(timezone.utc), frozen_report=_report(allocation=[{"asset": "QQQ", "weight": 0.6}, {"asset": "TLT", "weight": 0.4}]), snapshot_metadata={})
    snapshot_b = WeeklySnapshot(id=2, snapshot_date=date(2026, 4, 4), created_at=datetime.now(timezone.utc), frozen_report=_report(allocation=[{"asset": "QQQ", "weight": 0.4}, {"asset": "TLT", "weight": 0.6}]), snapshot_metadata={})
    db = _FakeDB(snapshots=[snapshot_a, snapshot_b])

    comparison = FridayService.compare_snapshots(db, date(2026, 3, 28), date(2026, 4, 4))

    changed = {item["symbol"]: item for item in comparison["deltas"]["holdings_changed"]}
    assert changed["QQQ"]["delta"] == pytest.approx(-0.2)
    assert changed["TLT"]["delta"] == pytest.approx(0.2)


def test_compare_snapshots_raises_when_first_missing():
    snapshot_b = WeeklySnapshot(id=2, snapshot_date=date(2026, 4, 4), created_at=datetime.now(timezone.utc), frozen_report=_report(), snapshot_metadata={})
    db = _FakeDB(snapshots=[snapshot_b])

    with pytest.raises(SnapshotNotFoundError):
        FridayService.compare_snapshots(db, date(2026, 3, 28), date(2026, 4, 4))


def test_compare_snapshots_raises_when_second_missing():
    snapshot_a = WeeklySnapshot(id=1, snapshot_date=date(2026, 3, 28), created_at=datetime.now(timezone.utc), frozen_report=_report(), snapshot_metadata={})
    db = _FakeDB(snapshots=[snapshot_a])

    with pytest.raises(SnapshotNotFoundError):
        FridayService.compare_snapshots(db, date(2026, 3, 28), date(2026, 4, 4))


def test_get_current_report_uses_week_ending(monkeypatch):
    monkeypatch.setattr(ReportService, "get_week_ending", staticmethod(lambda target_date=None: date(2026, 4, 3)))
    monkeypatch.setattr(ReportService, "build_weekly_report", staticmethod(lambda db, week_ending: _report()))

    payload = FridayService.get_current_report(_FakeDB())

    assert payload["weekEnding"] == "2026-04-03"


def test_get_week_ending_uses_target_date_directly():
    assert ReportService.get_week_ending(date(2026, 4, 4)).isoformat() == "2026-04-03"


def test_snapshot_metadata_tracks_errors(monkeypatch):
    db = _FakeDB()
    monkeypatch.setattr(ReportService, "build_weekly_report", staticmethod(lambda db, week_ending: (_ for _ in ()).throw(RuntimeError("boom"))))
    monkeypatch.setattr(FridayService, "_build_partial_report", staticmethod(lambda db, snapshot_date, initial_error: (_report(status="partial"), {"portfolio": True, "macro": False, "signals": True, "annotations": False, "score": False, "recommendation": False}, {"report": initial_error, "macro": "down"})))

    created = FridayService.create_snapshot(db, date(2026, 4, 3))

    assert created["metadata"]["errors"]["report"] == "boom"
    assert created["metadata"]["errors"]["macro"] == "down"
