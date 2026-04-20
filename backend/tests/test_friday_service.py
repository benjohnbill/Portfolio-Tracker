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
        self._filters = []
        self._orderings = []

    def all(self):
        rows = [row for row in self._rows if self._matches(row)]
        return self._apply_order(rows)

    def filter(self, *conditions):
        self._filters.extend(conditions)
        return self

    def first(self):
        rows = self.all()
        return rows[0] if rows else None

    def order_by(self, *orderings):
        self._orderings.extend(orderings)
        return self

    def _matches(self, row):
        for condition in self._filters:
            left = getattr(condition, "left", None)
            right = getattr(condition, "right", None)
            operator = getattr(getattr(condition, "operator", None), "__name__", "")
            field = getattr(left, "name", None)
            value = getattr(right, "value", None)
            if operator == "eq" and field is not None and getattr(row, field) != value:
                return False
            if operator == "lt" and field is not None and not getattr(row, field) < value:
                return False
        return True

    def _apply_order(self, rows):
        ordered = list(rows)
        for ordering in reversed(self._orderings):
            field = getattr(getattr(ordering, "element", None), "name", None) or getattr(ordering, "name", None)
            modifier = getattr(getattr(ordering, "modifier", None), "__name__", "")
            reverse = modifier == "desc_op"
            if field is None:
                continue
            ordered.sort(key=lambda row: (getattr(row, field, None) is None, getattr(row, field, None)), reverse=reverse)
        return ordered


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
    decision = WeeklyDecision(id=9, snapshot_id=7, created_at=datetime.now(timezone.utc), decision_type="hold", asset_ticker="QQQ", note="Stay put", confidence_vs_spy_riskadj=7, invalidation="Break trend")
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

    decision = FridayService.add_decision(db, snapshot_id=7, decision_type="rebalance", asset_ticker="QQQ", note="Trim exposure", confidence_vs_spy_riskadj=8, invalidation="Macro improves")

    assert decision["snapshotId"] == 7
    assert decision["decisionType"] == "rebalance"
    assert len(db.decisions) == 1


def test_add_decision_rejects_missing_snapshot():
    db = _FakeDB()

    with pytest.raises(SnapshotNotFoundError):
        FridayService.add_decision(db, snapshot_id=99, decision_type="hold", note="none", confidence_vs_spy_riskadj=5)


def test_add_decision_rejects_invalid_confidence():
    snapshot = WeeklySnapshot(id=7, snapshot_date=date(2026, 4, 3), created_at=datetime.now(timezone.utc), frozen_report=_report(), snapshot_metadata={})
    db = _FakeDB(snapshots=[snapshot])

    with pytest.raises(SnapshotValidationError):
        FridayService.add_decision(db, snapshot_id=7, decision_type="hold", note="none", confidence_vs_spy_riskadj=11)


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


def test_get_latest_report_returns_current_week_persisted_row(monkeypatch):
    current_week = date(2026, 4, 3)
    record = _Obj(
        week_ending=current_week,
        report_json=_report(score=72),
        llm_summary_json={"headline": "steady"},
    )
    db = _FakeDB()
    db.weekly_reports = [record]

    def _query(model):
        if getattr(model, "__name__", str(model)) == "WeeklyReport":
            return _FakeQuery(db.weekly_reports)
        return _FakeDB.query(db, model)

    monkeypatch.setattr(db, "query", _query)
    monkeypatch.setattr(ReportService, "get_week_ending", staticmethod(lambda target_date=None: current_week))

    payload = ReportService.get_latest_report(db)

    assert payload["score"]["total"] == 72
    assert payload["llmSummary"] == {"headline": "steady"}


def test_get_latest_report_falls_back_to_latest_persisted_row(monkeypatch):
    current_week = date(2026, 4, 10)
    older = _Obj(
        week_ending=date(2026, 4, 3),
        report_json=_report(score=64),
        llm_summary_json=None,
    )
    newest = _Obj(
        week_ending=date(2026, 4, 4),
        report_json=_report(score=66),
        llm_summary_json={"headline": "latest"},
    )
    db = _FakeDB()
    db.weekly_reports = [older, newest]

    def _query(model):
        if getattr(model, "__name__", str(model)) == "WeeklyReport":
            return _FakeQuery(db.weekly_reports)
        return _FakeDB.query(db, model)

    monkeypatch.setattr(db, "query", _query)
    monkeypatch.setattr(ReportService, "get_week_ending", staticmethod(lambda target_date=None: current_week))

    payload = ReportService.get_latest_report(db)

    assert payload["score"]["total"] == 66
    assert payload["llmSummary"] == {"headline": "latest"}


def test_get_latest_report_returns_none_when_no_persisted_rows(monkeypatch):
    db = _FakeDB()
    db.weekly_reports = []

    def _query(model):
        if getattr(model, "__name__", str(model)) == "WeeklyReport":
            return _FakeQuery(db.weekly_reports)
        return _FakeDB.query(db, model)

    monkeypatch.setattr(db, "query", _query)

    assert ReportService.get_latest_report(db) is None


def test_weekly_decision_model_has_three_confidence_scalars_and_invalidation_fields():
    # Smoke test: the ORM class exposes the new Phase D A3 / A4 columns.
    from app.models import WeeklyDecision

    column_names = {c.name for c in WeeklyDecision.__table__.columns}
    assert "confidence_vs_spy_riskadj" in column_names
    assert "confidence_vs_cash" in column_names
    assert "confidence_vs_spy_pure" in column_names
    assert "expected_failure_mode" in column_names
    assert "trigger_threshold" in column_names
    assert "confidence" not in column_names  # legacy name must be gone at ORM level


def test_weekly_snapshot_model_has_comment_column():
    from app.models import WeeklySnapshot

    column_names = {c.name for c in WeeklySnapshot.__table__.columns}
    assert "comment" in column_names


def test_add_decision_accepts_three_confidence_scalars_and_structured_invalidation():
    snapshot = WeeklySnapshot(
        id=7, snapshot_date=date(2026, 4, 18),
        created_at=datetime.now(timezone.utc),
        frozen_report=_report(), snapshot_metadata={},
    )
    db = _FakeDB(snapshots=[snapshot])

    payload = FridayService.add_decision(
        db,
        snapshot_id=7,
        decision_type="rebalance",
        asset_ticker="QQQ",
        note="Trim exposure",
        confidence_vs_spy_riskadj=8,
        confidence_vs_cash=7,
        confidence_vs_spy_pure=6,
        invalidation="Macro improves",
        expected_failure_mode="regime_shift",
        trigger_threshold=0.05,
    )

    assert payload["confidenceVsSpyRiskadj"] == 8
    assert payload["confidenceVsCash"] == 7
    assert payload["confidenceVsSpyPure"] == 6
    assert payload["expectedFailureMode"] == "regime_shift"
    assert payload["triggerThreshold"] == 0.05




def test_add_decision_rejects_invalid_confidence_scalar_range():
    snapshot = WeeklySnapshot(
        id=7, snapshot_date=date(2026, 4, 18),
        created_at=datetime.now(timezone.utc),
        frozen_report=_report(), snapshot_metadata={},
    )
    db = _FakeDB(snapshots=[snapshot])

    # Primary scalar out of range.
    with pytest.raises(SnapshotValidationError):
        FridayService.add_decision(db, snapshot_id=7, decision_type="hold", note="x", confidence_vs_spy_riskadj=11)

    # vs_cash out of range.
    with pytest.raises(SnapshotValidationError):
        FridayService.add_decision(
            db, snapshot_id=7, decision_type="hold", note="x",
            confidence_vs_spy_riskadj=5, confidence_vs_cash=0,
        )


def test_add_decision_requires_primary_scalar():
    snapshot = WeeklySnapshot(
        id=7, snapshot_date=date(2026, 4, 18),
        created_at=datetime.now(timezone.utc),
        frozen_report=_report(), snapshot_metadata={},
    )
    db = _FakeDB(snapshots=[snapshot])

    with pytest.raises(SnapshotValidationError):
        FridayService.add_decision(
            db, snapshot_id=7, decision_type="hold", note="x",
        )


def test_serialize_decision_does_not_emit_legacy_confidence_key():
    """Plan C contract: response payload must not mirror the legacy `confidence` key."""
    snapshot = WeeklySnapshot(
        id=7, snapshot_date=date(2026, 4, 18),
        created_at=datetime.now(timezone.utc),
        frozen_report=_report(), snapshot_metadata={},
    )
    db = _FakeDB(snapshots=[snapshot])

    payload = FridayService.add_decision(
        db,
        snapshot_id=7,
        decision_type="hold",
        note="x",
        confidence_vs_spy_riskadj=6,
    )

    assert "confidence" not in payload
    assert payload["confidenceVsSpyRiskadj"] == 6


def test_create_snapshot_persists_comment(monkeypatch):
    monkeypatch.setattr(ReportService, "build_weekly_report", lambda db, d: _report())
    db = _FakeDB()
    created = FridayService.create_snapshot(db, date(2026, 4, 3), comment="조용한 한 주, 판단 유지.")
    assert created["comment"] == "조용한 한 주, 판단 유지."
    assert db.snapshots[0].comment == "조용한 한 주, 판단 유지."


def test_create_snapshot_comment_defaults_to_none(monkeypatch):
    monkeypatch.setattr(ReportService, "build_weekly_report", lambda db, d: _report())
    db = _FakeDB()
    created = FridayService.create_snapshot(db, date(2026, 4, 3))
    assert created["comment"] is None
    assert db.snapshots[0].comment is None


def test_create_snapshot_populates_risk_metrics_on_success():
    from app.services.friday_service import FridayService
    from datetime import date as _date
    from unittest.mock import patch

    payload = {
        "as_of": "2026-04-17",
        "trailing_1y": {"portfolio": {}, "spy_krw": {}},
        "data_quality": {"portfolio_days": 252, "spy_krw_days": 250, "source": "yfinance+fdr"},
    }
    with patch("app.services.friday_service.RiskAdjustedService") as MockRA, \
         patch("app.services.friday_service.ReportService") as MockReport:
        MockRA.compute_snapshot_metrics.return_value = payload
        MockReport.get_week_ending.return_value = _date(2026, 4, 17)
        MockReport.build_weekly_report.return_value = {"portfolioSnapshot": {}, "score": {"total": 80}}

        db = _FakeDB()
        result = FridayService.create_snapshot(db, snapshot_date=_date(2026, 4, 17), comment="qa")

    stored = db.snapshots[-1]
    assert stored.risk_metrics == payload
    assert result["comment"] == "qa"


def test_create_snapshot_tolerates_risk_metrics_failure():
    from app.services.friday_service import FridayService
    from datetime import date as _date
    from unittest.mock import patch

    with patch("app.services.friday_service.RiskAdjustedService") as MockRA, \
         patch("app.services.friday_service.ReportService") as MockReport:
        MockRA.compute_snapshot_metrics.side_effect = RuntimeError("upstream blew up")
        MockReport.get_week_ending.return_value = _date(2026, 4, 17)
        MockReport.build_weekly_report.return_value = {"portfolioSnapshot": {}, "score": {"total": 80}}

        db = _FakeDB()
        result = FridayService.create_snapshot(db, snapshot_date=_date(2026, 4, 17))

    stored = db.snapshots[-1]
    assert stored.risk_metrics is None  # freeze still succeeded; metrics left NULL
    assert result is not None
