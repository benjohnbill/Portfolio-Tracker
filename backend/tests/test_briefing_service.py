from datetime import date, datetime, timezone, timedelta

import pytest

from app.models import CronRunLog, DecisionOutcome, WeeklyDecision, WeeklySnapshot
from app.services.briefing_service import BriefingService


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows
        self._filters = []
        self._orderings = []

    def filter(self, *conditions):
        self._filters.extend(conditions)
        return self

    def order_by(self, *orderings):
        self._orderings.extend(orderings)
        return self

    def all(self):
        rows = [row for row in self._rows if self._matches(row)]
        for ordering in reversed(self._orderings):
            field = getattr(getattr(ordering, "element", None), "name", None) or getattr(ordering, "name", None)
            modifier = getattr(getattr(ordering, "modifier", None), "__name__", "")
            reverse = modifier == "desc_op"
            if field is None:
                continue
            rows.sort(key=lambda r: (getattr(r, field, None) is None, getattr(r, field, None)), reverse=reverse)
        return rows

    def _matches(self, row):
        for cond in self._filters:
            operator = getattr(getattr(cond, "operator", None), "__name__", "")
            left = getattr(cond, "left", None)
            right = getattr(cond, "right", None)
            field = getattr(left, "name", None)
            value = getattr(right, "value", None)
            if field is None:
                continue
            actual = getattr(row, field, None)
            if operator == "eq" and actual != value:
                return False
            if operator == "ne" and actual == value:
                return False
            if operator == "gt" and not (actual is not None and actual > value):
                return False
            if operator == "lt" and not (actual is not None and actual < value):
                return False
            if operator == "is_" and actual is not value:
                return False
            if operator == "isnot" and actual is value:
                return False
        return True


class _FakeDB:
    def __init__(self, snapshots=None, outcomes=None, decisions=None, cron_logs=None):
        self.snapshots = snapshots or []
        self.outcomes = outcomes or []
        self.decisions = decisions or []
        self.cron_logs = cron_logs or []

    def query(self, model):
        name = getattr(model, "__name__", str(model))
        if name == "WeeklySnapshot":
            return _FakeQuery(self.snapshots)
        if name == "DecisionOutcome":
            return _FakeQuery(self.outcomes)
        if name == "CronRunLog":
            return _FakeQuery(self.cron_logs)
        return _FakeQuery([])


def _snapshot(id, d, macro_buckets=None, comment=None):
    snap = WeeklySnapshot(
        id=id,
        snapshot_date=d,
        created_at=datetime.now(timezone.utc),
        frozen_report={"macroSnapshot": {"buckets": macro_buckets or []}},
        snapshot_metadata={},
        comment=comment,
    )
    return snap


def test_get_briefing_empty_state_when_no_snapshots():
    db = _FakeDB()
    result = BriefingService.get_briefing(db)
    assert result["sinceDate"] is None
    assert result["regimeTransitions"] == []
    assert result["maturedOutcomes"] == []
    assert result["alertHistory"] == {"success": 0, "failed": 0, "lastFailureAt": None, "lastFailureMessage": None}
    assert result["lastSnapshotComment"] is None


def test_get_briefing_surfaces_regime_transitions_between_last_two_snapshots():
    s1 = _snapshot(1, date(2026, 4, 12), [{"bucket": "liquidity", "state": "neutral"}, {"bucket": "rates", "state": "supportive"}])
    s2 = _snapshot(2, date(2026, 4, 19), [{"bucket": "liquidity", "state": "adverse"}, {"bucket": "rates", "state": "supportive"}])
    db = _FakeDB(snapshots=[s2, s1])
    result = BriefingService.get_briefing(db)
    assert result["sinceDate"] == "2026-04-19"
    assert result["regimeTransitions"] == [{"bucket": "liquidity", "from": "neutral", "to": "adverse"}]


def test_get_briefing_collects_matured_outcomes_since_baseline():
    s1 = _snapshot(1, date(2026, 4, 19))
    decision = WeeklyDecision(
        id=42, snapshot_id=1, created_at=datetime.now(timezone.utc),
        decision_type="rebalance", asset_ticker="QQQ", note="n",
        confidence_vs_spy_riskadj=7,
    )
    outcome_recent = DecisionOutcome(
        id=100, decision_id=42, snapshot_id=1, created_at=datetime.now(timezone.utc),
        evaluated_at=datetime(2026, 4, 21, tzinfo=timezone.utc),
        horizon="3m", outcome_delta_pct=-0.02, score_delta=-5,
    )
    outcome_recent.decision = decision
    outcome_old = DecisionOutcome(
        id=101, decision_id=42, snapshot_id=1, created_at=datetime.now(timezone.utc),
        evaluated_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        horizon="1m", outcome_delta_pct=0.01, score_delta=2,
    )
    outcome_old.decision = decision
    db = _FakeDB(snapshots=[s1], outcomes=[outcome_recent, outcome_old])
    result = BriefingService.get_briefing(db)
    assert len(result["maturedOutcomes"]) == 1
    row = result["maturedOutcomes"][0]
    assert row["decisionId"] == 42
    assert row["horizon"] == "3m"
    assert row["decisionType"] == "rebalance"
    assert row["assetTicker"] == "QQQ"


def test_get_briefing_counts_cron_success_and_failure_since_baseline():
    s1 = _snapshot(1, date(2026, 4, 19))
    ok = CronRunLog(id=1, job_name="update-signals", started_at=datetime(2026, 4, 20, 6, 0, tzinfo=timezone.utc), status="success")
    fail = CronRunLog(id=2, job_name="update-signals", started_at=datetime(2026, 4, 21, 6, 0, tzinfo=timezone.utc), status="failed", error_message="yfinance timeout")
    stale = CronRunLog(id=3, job_name="update-signals", started_at=datetime(2026, 4, 10, 6, 0, tzinfo=timezone.utc), status="failed", error_message="old")
    db = _FakeDB(snapshots=[s1], cron_logs=[ok, fail, stale])
    result = BriefingService.get_briefing(db)
    assert result["alertHistory"]["success"] == 1
    assert result["alertHistory"]["failed"] == 1
    assert result["alertHistory"]["lastFailureMessage"] == "yfinance timeout"


def test_get_briefing_returns_most_recent_non_empty_snapshot_comment():
    s1 = _snapshot(1, date(2026, 4, 5), comment="older comment")
    s2 = _snapshot(2, date(2026, 4, 12), comment=None)
    s3 = _snapshot(3, date(2026, 4, 19), comment="most recent")
    db = _FakeDB(snapshots=[s3, s2, s1])
    result = BriefingService.get_briefing(db)
    assert result["lastSnapshotComment"] == {"snapshotDate": "2026-04-19", "comment": "most recent"}
