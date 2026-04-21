# Phase D — `/friday` Top-of-Page (A1 + A2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two new `/friday` top-of-page surfaces — the A1 "Since Last Friday" briefing card and the A2 Sleeve Health panel — so users can see events-since-last-freeze + sleeve-level health at a glance before diving into per-holding drill-down.

**Architecture:** One new backend service (`briefing_service.py`) exposing two new endpoints. Two new frontend components rendered above the existing hero strip / portfolio delta region, server-fetched at the page level so the existing client component keeps its structure. No schema changes, no touches to `notification_service.py` / `discord_notifier.py` (Plan C), no changes to the legacy `confidence` alias (Plan C).

**Tech Stack:** Python 3, FastAPI, SQLAlchemy, Pydantic v2 (existing), pytest; Next.js 14 app router (server components), React 18, TypeScript, Tailwind, lucide-react.

**Out of scope (deferred):**
- Discord briefing echo (Plan C).
- Legacy `confidence` alias cleanup (Plan C).
- Any Deferred Phase D item (A5, A6, B-series, etc.).
- Removing the existing "Portfolio delta" card — A2 sits above it; drill-down stays per DESIGN.md Friday Hierarchy (item 3 vs item 4).

**Authoritative references:**
- `docs/superpowers/decisions/2026-04-19-phase-d-ship-now-scope-lock.md` § Plan B.
- `DESIGN.md` Friday Page Hierarchy (items 1 and 3).
- `PRODUCT.md` §9 Accumulation-as-Hero.

---

## File Structure

**Files created:**

- `backend/app/services/briefing_service.py` — aggregation logic for both endpoints. One class (`BriefingService`) with static methods. Kept out of `friday_service.py` which is already ~350 lines.
- `backend/tests/test_briefing_service.py` — unit tests against the existing `_FakeDB` pattern.
- `frontend/src/components/friday/SinceLastFridayBriefing.tsx` — A1 card component.
- `frontend/src/components/friday/SleeveHealthPanel.tsx` — A2 panel component.

**Files modified:**

- `backend/app/main.py` — two new endpoints: `GET /api/v1/friday/briefing` and `GET /api/v1/friday/sleeve-history`.
- `backend/tests/test_api.py` — one new test per endpoint.
- `frontend/src/lib/api.ts` — two new types (`FridayBriefingData`, `SleeveHistoryData`) + two fetch helpers (`getFridayBriefing`, `getFridaySleeveHistory`).
- `frontend/src/app/friday/page.tsx` — parallel-fetch the two new data sources and pass as props to `FridayDashboard`.
- `frontend/src/components/friday/FridayDashboard.tsx` — accept `briefing` + `sleeveHistory` props, render the two new components at correct positions.

**Files NOT modified:**

- `backend/app/models.py` — no schema changes.
- `backend/app/services/friday_service.py` — briefing logic goes into `briefing_service.py`.
- `backend/app/services/notification_service.py` / `discord_notifier.py` — Plan C.
- Any intelligence service file — Plan B is strictly `/friday`-surface.

---

## Sleeve ↔ asset mapping (key design decision)

The A2 panel displays 6 fixed sleeves: `NDX / DBMF / BRAZIL / MSTR / GLDM / BONDS-CASH`. The `/api/v1/reports/weekly/*` data ships `portfolioSnapshot.targetDeviation[]` where each entry has a `category` string. If `category` matches a sleeve label (case-insensitive, hyphen/space-normalized fuzzy match), the component renders real current%/target% values. If not, it renders em-dash placeholders — the component degrades gracefully rather than blocking.

Signal status for a sleeve: match `triggeredRules[i].affectedSleeves` against the sleeve label using the same fuzzy match.

4-week recency strip: the backend endpoint returns per-sleeve rule-firing counts per week, aggregated from the last 4 `weekly_reports.report_json.triggeredRules`.

**No new schema, no new DB column.** All data is already present in the existing tables.

---

## Task 1: Backend — `BriefingService.get_briefing` + endpoint

**Files:**

- Create: `backend/app/services/briefing_service.py`
- Create: `backend/tests/test_briefing_service.py`
- Modify: `backend/app/main.py` — add one endpoint.

### Step 1: Create the `BriefingService` skeleton

Create `backend/app/services/briefing_service.py`:

```python
"""
Briefing service — aggregates the `/friday` top-of-page "Since Last Friday" card and
the 4-week sleeve-recency strip from existing tables. No schema changes.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ..models import CronRunLog, DecisionOutcome, WeeklyDecision, WeeklyReport, WeeklySnapshot


# Fixed sleeve list per DESIGN.md Friday Hierarchy item 3.
SLEEVES: List[str] = ["NDX", "DBMF", "BRAZIL", "MSTR", "GLDM", "BONDS-CASH"]


def _normalize(label: str) -> str:
    """Case- and punctuation-insensitive comparator key for sleeve names."""
    return label.upper().replace("-", "").replace("_", "").replace(" ", "")


class BriefingService:
    """Read-only aggregations for /friday top-of-page cards."""

    @staticmethod
    def get_briefing(db: Session, since: Optional[date] = None) -> Dict[str, Any]:
        """
        Aggregate "Since Last Friday" briefing.

        Default `since` = the most recent prior snapshot's date. If no prior snapshot
        exists, returns an empty briefing (first-freeze empty state).
        """
        snapshots = (
            db.query(WeeklySnapshot).order_by(WeeklySnapshot.snapshot_date.desc()).all()
        )
        if not snapshots:
            return {
                "sinceDate": None,
                "regimeTransitions": [],
                "maturedOutcomes": [],
                "alertHistory": {"success": 0, "failed": 0, "lastFailureAt": None, "lastFailureMessage": None},
                "lastSnapshotComment": None,
            }

        baseline = snapshots[0]
        since_date = since or baseline.snapshot_date
        since_dt = datetime.combine(since_date, datetime.min.time(), tzinfo=timezone.utc)

        # Regime transitions: diff the last 2 snapshots' macroSnapshot.buckets.
        transitions = BriefingService._regime_transitions(snapshots)

        # Matured outcomes evaluated since the baseline.
        outcomes = BriefingService._matured_outcomes(db, since_dt)

        # Cron alert history since the baseline.
        alerts = BriefingService._alert_history(db, since_dt)

        # Last snapshot comment (most recent non-empty).
        last_comment = BriefingService._last_snapshot_comment(snapshots)

        return {
            "sinceDate": since_date.isoformat(),
            "regimeTransitions": transitions,
            "maturedOutcomes": outcomes,
            "alertHistory": alerts,
            "lastSnapshotComment": last_comment,
        }

    @staticmethod
    def _regime_transitions(snapshots: List[WeeklySnapshot]) -> List[Dict[str, Any]]:
        if len(snapshots) < 2:
            return []
        current = (snapshots[0].frozen_report or {}).get("macroSnapshot", {}).get("buckets", []) or []
        prior = (snapshots[1].frozen_report or {}).get("macroSnapshot", {}).get("buckets", []) or []
        prior_by_bucket = {entry.get("bucket"): entry.get("state") for entry in prior if isinstance(entry, dict)}
        transitions: List[Dict[str, Any]] = []
        for entry in current:
            if not isinstance(entry, dict):
                continue
            bucket = entry.get("bucket")
            new_state = entry.get("state")
            prior_state = prior_by_bucket.get(bucket)
            if bucket and new_state and prior_state and new_state != prior_state:
                transitions.append({
                    "bucket": bucket,
                    "from": prior_state,
                    "to": new_state,
                })
        return transitions

    @staticmethod
    def _matured_outcomes(db: Session, since_dt: datetime) -> List[Dict[str, Any]]:
        rows = (
            db.query(DecisionOutcome)
            .filter(DecisionOutcome.evaluated_at != None)  # noqa: E711
            .filter(DecisionOutcome.evaluated_at > since_dt)
            .order_by(DecisionOutcome.evaluated_at.desc())
            .all()
        )
        results: List[Dict[str, Any]] = []
        for outcome in rows:
            decision = outcome.decision
            results.append({
                "decisionId": outcome.decision_id,
                "horizon": outcome.horizon,
                "outcomeDeltaPct": outcome.outcome_delta_pct,
                "scoreDelta": outcome.score_delta,
                "evaluatedAt": outcome.evaluated_at.isoformat() if outcome.evaluated_at else None,
                "decisionType": decision.decision_type if decision else None,
                "assetTicker": decision.asset_ticker if decision else None,
            })
        return results

    @staticmethod
    def _alert_history(db: Session, since_dt: datetime) -> Dict[str, Any]:
        logs = (
            db.query(CronRunLog)
            .filter(CronRunLog.started_at > since_dt)
            .order_by(CronRunLog.started_at.desc())
            .all()
        )
        success = sum(1 for row in logs if row.status == "success")
        failed = sum(1 for row in logs if row.status == "failed")
        last_failure = next((row for row in logs if row.status == "failed"), None)
        return {
            "success": success,
            "failed": failed,
            "lastFailureAt": last_failure.started_at.isoformat() if last_failure else None,
            "lastFailureMessage": last_failure.error_message if last_failure else None,
        }

    @staticmethod
    def _last_snapshot_comment(snapshots: List[WeeklySnapshot]) -> Optional[Dict[str, Any]]:
        for snap in snapshots:
            if snap.comment:
                return {
                    "snapshotDate": snap.snapshot_date.isoformat() if snap.snapshot_date else None,
                    "comment": snap.comment,
                }
        return None
```

### Step 2: Write failing tests

Create `backend/tests/test_briefing_service.py`:

```python
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
        rows = list(self._rows)
        for ordering in reversed(self._orderings):
            field = getattr(getattr(ordering, "element", None), "name", None) or getattr(ordering, "name", None)
            modifier = getattr(getattr(ordering, "modifier", None), "__name__", "")
            reverse = modifier == "desc_op"
            if field is None:
                continue
            rows.sort(key=lambda r: (getattr(r, field, None) is None, getattr(r, field, None)), reverse=reverse)
        return rows


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
```

### Step 3: Run tests — expect 5 FAIL

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m pytest tests/test_briefing_service.py -v
```

Expected: 5 tests run. They will FAIL — not because the logic is wrong, but because the `_FakeQuery` doesn't implement the `!= None` / `>` comparisons correctly against SQLAlchemy ColumnExpression objects in the filter chain. See Step 4 to fix.

### Step 4: Implement a richer `_FakeQuery.filter` that survives SQLAlchemy expressions

The service uses `.filter(DecisionOutcome.evaluated_at != None)` and `.filter(DecisionOutcome.evaluated_at > since_dt)`. The existing `_FakeQuery` in `test_friday_service.py` handles `eq` / `lt` — extend the test-local version to handle `ne` and `gt` too.

Replace the `filter` / matching logic in `_FakeQuery` inside `test_briefing_service.py` with:

```python
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
```

Run tests again — expect 5 PASS.

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m pytest tests/test_briefing_service.py -v
```

### Step 5: Wire the endpoint in `backend/app/main.py`

In `backend/app/main.py`, find the other `/api/v1/friday/...` endpoints (around lines 422-488). Immediately after `list_friday_snapshots` (line 422), add:

```python
@app.get("/api/v1/friday/briefing")
def get_friday_briefing(since: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        since_date = datetime.strptime(since, "%Y-%m-%d").date() if since else None
    except ValueError:
        raise HTTPException(status_code=400, detail="since must be YYYY-MM-DD")

    try:
        from .services.briefing_service import BriefingService
        return BriefingService.get_briefing(db, since=since_date)
    except Exception as e:
        print(f"Error in GET /api/v1/friday/briefing: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Step 6: Add API-level test to `backend/tests/test_api.py`

Append:

```python
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
```

### Step 7: Run the whole backend suite

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m pytest -v 2>&1 | tail -5
```

Expected: 55 + 5 + 2 = 62 passed, no regressions.

### Step 8: Commit

```bash
cd /home/lg/dev/Portfolio_Tracker
git add backend/app/services/briefing_service.py backend/tests/test_briefing_service.py backend/app/main.py backend/tests/test_api.py
git diff --cached --stat
```

Expected: 4 files.

```bash
git commit -m "$(cat <<'EOF'
feat(friday): add BriefingService + GET /api/v1/friday/briefing for Since-Last-Friday card

Phase D A1 backend. Aggregates regime transitions (diff between last
two snapshots' macroSnapshot.buckets), matured outcomes (DecisionOutcome
rows with evaluated_at > baseline), cron alert history (CronRunLog
success/failed counts + last failure), and most recent non-empty
snapshot comment (weekly_snapshots.comment).

No schema change. Read-only aggregation over existing tables.

Tests: 5 unit (empty state, regime diff, outcomes since, alert counts,
comment fallback) + 2 API (200 smoke + 400 on malformed date).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Backend — `BriefingService.get_sleeve_history` + endpoint

**Files:**

- Modify: `backend/app/services/briefing_service.py` — add static method.
- Modify: `backend/tests/test_briefing_service.py` — add tests.
- Modify: `backend/app/main.py` — add second endpoint.
- Modify: `backend/tests/test_api.py` — add API test.

### Step 1: Write failing tests for `get_sleeve_history`

Append to `backend/tests/test_briefing_service.py`:

```python
def _weekly_report(week_ending, rules):
    report = WeeklyReport(
        id=hash(week_ending) % 1000,
        week_ending=week_ending,
        generated_at=datetime.now(timezone.utc),
        logic_version="weekly-report-v0",
        status="final",
        report_json={"triggeredRules": rules},
    )
    return report


class _FakeDBWithReports(_FakeDB):
    def __init__(self, reports=None, **kwargs):
        super().__init__(**kwargs)
        self.reports = reports or []

    def query(self, model):
        name = getattr(model, "__name__", str(model))
        if name == "WeeklyReport":
            return _FakeQuery(self.reports)
        return super().query(model)


def test_get_sleeve_history_returns_zero_strip_when_no_reports():
    db = _FakeDBWithReports()
    result = BriefingService.get_sleeve_history(db, weeks=4)
    for sleeve in ["NDX", "DBMF", "BRAZIL", "MSTR", "GLDM", "BONDS-CASH"]:
        assert result[sleeve] == [0, 0, 0, 0]


def test_get_sleeve_history_counts_rules_per_sleeve_per_week():
    r1 = _weekly_report(date(2026, 4, 5), [
        {"ruleId": "R1", "affectedSleeves": ["NDX"]},
        {"ruleId": "R2", "affectedSleeves": ["NDX", "DBMF"]},
    ])
    r2 = _weekly_report(date(2026, 4, 12), [
        {"ruleId": "R3", "affectedSleeves": ["BRAZIL"]},
    ])
    r3 = _weekly_report(date(2026, 4, 19), [])
    r4 = _weekly_report(date(2026, 4, 26), [
        {"ruleId": "R4", "affectedSleeves": ["NDX"]},
        {"ruleId": "R5", "affectedSleeves": ["GLDM"]},
    ])
    # Order by desc week_ending; service should flip to ascending in output
    db = _FakeDBWithReports(reports=[r4, r3, r2, r1])
    result = BriefingService.get_sleeve_history(db, weeks=4)
    assert result["NDX"] == [2, 0, 0, 1]
    assert result["DBMF"] == [1, 0, 0, 0]
    assert result["BRAZIL"] == [0, 1, 0, 0]
    assert result["GLDM"] == [0, 0, 0, 1]
    assert result["MSTR"] == [0, 0, 0, 0]
    assert result["BONDS-CASH"] == [0, 0, 0, 0]


def test_get_sleeve_history_matches_sleeve_labels_case_insensitively():
    r = _weekly_report(date(2026, 4, 26), [
        {"ruleId": "R1", "affectedSleeves": ["bonds-cash"]},
        {"ruleId": "R2", "affectedSleeves": ["ndx"]},
    ])
    db = _FakeDBWithReports(reports=[r])
    result = BriefingService.get_sleeve_history(db, weeks=1)
    assert result["BONDS-CASH"] == [1]
    assert result["NDX"] == [1]


def test_get_sleeve_history_caps_weeks_between_1_and_52():
    db = _FakeDBWithReports()
    with pytest.raises(ValueError):
        BriefingService.get_sleeve_history(db, weeks=0)
    with pytest.raises(ValueError):
        BriefingService.get_sleeve_history(db, weeks=53)
```

### Step 2: Run — expect 4 FAIL

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m pytest tests/test_briefing_service.py -k "sleeve_history" -v
```

Expected: `AttributeError: type object 'BriefingService' has no attribute 'get_sleeve_history'`.

### Step 3: Implement `get_sleeve_history`

Append to `backend/app/services/briefing_service.py` inside the `BriefingService` class (just before the closing — after the last helper method):

```python
    @staticmethod
    def get_sleeve_history(db: Session, weeks: int = 4) -> Dict[str, List[int]]:
        """
        Per-sleeve rule-firing count for the last N weekly reports (ascending by
        week_ending in the output arrays — oldest first, newest last).
        """
        if not (1 <= weeks <= 52):
            raise ValueError("weeks must be between 1 and 52")

        rows = (
            db.query(WeeklyReport)
            .order_by(WeeklyReport.week_ending.desc())
            .all()
        )
        recent = rows[:weeks]
        recent.reverse()  # oldest-first in output

        # Pad left with zero-reports if fewer than `weeks` rows exist.
        padding = weeks - len(recent)
        padded: List[Optional[WeeklyReport]] = [None] * padding + list(recent)

        result: Dict[str, List[int]] = {sleeve: [] for sleeve in SLEEVES}
        sleeve_keys = {sleeve: _normalize(sleeve) for sleeve in SLEEVES}

        for report in padded:
            rules = []
            if report is not None:
                rules = (report.report_json or {}).get("triggeredRules", []) or []
            counts = {sleeve: 0 for sleeve in SLEEVES}
            for rule in rules:
                if not isinstance(rule, dict):
                    continue
                affected = rule.get("affectedSleeves") or []
                affected_norm = {_normalize(str(a)) for a in affected if a}
                for sleeve, norm_key in sleeve_keys.items():
                    if norm_key in affected_norm:
                        counts[sleeve] += 1
            for sleeve in SLEEVES:
                result[sleeve].append(counts[sleeve])
        return result
```

### Step 4: Run — expect 4 PASS

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m pytest tests/test_briefing_service.py -k "sleeve_history" -v
```

Expected: 4 passed.

### Step 5: Add endpoint

In `backend/app/main.py`, immediately after the `get_friday_briefing` endpoint from Task 1, add:

```python
@app.get("/api/v1/friday/sleeve-history")
def get_friday_sleeve_history(weeks: int = 4, db: Session = Depends(get_db)):
    try:
        from .services.briefing_service import BriefingService
        return BriefingService.get_sleeve_history(db, weeks=weeks)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as e:
        print(f"Error in GET /api/v1/friday/sleeve-history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Step 6: API-level test in `backend/tests/test_api.py`

Append:

```python
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
```

### Step 7: Run full suite

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m pytest -v 2>&1 | tail -5
```

Expected: 62 + 4 + 2 = 68 passed.

### Step 8: Commit

```bash
cd /home/lg/dev/Portfolio_Tracker
git add backend/app/services/briefing_service.py backend/tests/test_briefing_service.py backend/app/main.py backend/tests/test_api.py
git diff --cached --stat
```

Expected: 4 files.

```bash
git commit -m "$(cat <<'EOF'
feat(friday): add GET /api/v1/friday/sleeve-history for the 4-week recency strip

Phase D A2 backend support. Scans the last N weekly_reports
(1..52, default 4) and returns per-sleeve rule-firing counts per
week, oldest-first, zero-padded if fewer than N reports exist.

Sleeve matching is case- and punctuation-insensitive so legacy
data variations like "bonds-cash" / "BondsCash" / "BONDS_CASH"
all collapse to the canonical BONDS-CASH bucket.

Fixed sleeve list: NDX / DBMF / BRAZIL / MSTR / GLDM / BONDS-CASH.

Tests: 4 unit + 2 API.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Frontend — api.ts types + fetch helpers

**Files:**

- Modify: `frontend/src/lib/api.ts` — append two types, two fetch helpers.

### Step 1: Append new interfaces

Find a reasonable anchor point for the new types. A good spot is immediately after the `FridaySnapshot` interface (around line 305-307). Insert:

```typescript
export interface FridayBriefingData {
  sinceDate: string | null;
  regimeTransitions: Array<{
    bucket: string;
    from: string;
    to: string;
  }>;
  maturedOutcomes: Array<{
    decisionId: number;
    horizon: string;
    outcomeDeltaPct: number | null;
    scoreDelta: number | null;
    evaluatedAt: string | null;
    decisionType: string | null;
    assetTicker: string | null;
  }>;
  alertHistory: {
    success: number;
    failed: number;
    lastFailureAt: string | null;
    lastFailureMessage: string | null;
  };
  lastSnapshotComment: {
    snapshotDate: string | null;
    comment: string;
  } | null;
}

export type SleeveHistoryData = Record<
  'NDX' | 'DBMF' | 'BRAZIL' | 'MSTR' | 'GLDM' | 'BONDS-CASH',
  number[]
>;
```

### Step 2: Append fetch helpers

Locate where `getFridaySnapshot` is defined (around line 604). Right after it, insert:

```typescript
export async function getFridayBriefing(since?: string): Promise<FridayBriefingData | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    const res = await fetch(`${API_BASE}/api/v1/friday/briefing${qs}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch Friday briefing');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

export async function getFridaySleeveHistory(weeks: number = 4): Promise<SleeveHistoryData | null> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/friday/sleeve-history?weeks=${weeks}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch Friday sleeve history');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}
```

### Step 3: Type-check

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean.

### Step 4: Commit

```bash
cd /home/lg/dev/Portfolio_Tracker
git add frontend/src/lib/api.ts
git diff --cached --stat
```

Expected: 1 file.

```bash
git commit -m "$(cat <<'EOF'
refactor(api types): add FridayBriefingData + SleeveHistoryData + fetch helpers

Frontend wiring for Phase D A1 / A2 backend endpoints (Tasks 1-2 on
this branch). Follows the existing graceful-null-on-failure pattern
from getFridaySnapshots and getWeeklyReport.

Components that consume these types land in follow-on commits on
this branch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frontend — `SinceLastFridayBriefing` component

**Files:**

- Create: `frontend/src/components/friday/SinceLastFridayBriefing.tsx`.

### Step 1: Create the component

```tsx
"use client";

import { AlertTriangle, CheckCircle2, Clock3, MessageSquare } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FridayBriefingData } from '@/lib/api';


interface SinceLastFridayBriefingProps {
  data: FridayBriefingData | null;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function SinceLastFridayBriefing({ data }: SinceLastFridayBriefingProps) {
  if (!data || data.sinceDate === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock3 className="w-4 h-4 text-primary" /> Since Last Friday
          </CardTitle>
          <CardDescription>No prior freeze yet — start your first ritual to begin the weekly memory trail.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasContent =
    data.regimeTransitions.length > 0 ||
    data.maturedOutcomes.length > 0 ||
    data.alertHistory.failed > 0 ||
    data.alertHistory.success > 0 ||
    data.lastSnapshotComment != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Clock3 className="w-4 h-4 text-primary" /> Since Last Friday
        </CardTitle>
        <CardDescription>Events since {data.sinceDate}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasContent && (
          <p className="text-sm text-muted-foreground">Nothing new since the prior freeze.</p>
        )}

        {data.regimeTransitions.length > 0 && (
          <div className="rounded-lg bg-background px-4 py-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-amber-400" /> Regime transitions
            </p>
            {data.regimeTransitions.map((transition) => (
              <p key={transition.bucket} className="text-sm text-white">
                <span className="font-semibold">{transition.bucket}</span>
                <span className="text-muted-foreground"> {transition.from} → </span>
                <span className="text-white/90">{transition.to}</span>
              </p>
            ))}
          </div>
        )}

        {data.maturedOutcomes.length > 0 && (
          <div className="rounded-lg bg-background px-4 py-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-primary" /> Matured outcomes ({data.maturedOutcomes.length})
            </p>
            {data.maturedOutcomes.slice(0, 5).map((outcome) => {
              const deltaSign = (outcome.outcomeDeltaPct ?? 0) >= 0 ? '+' : '';
              const colorClass = (outcome.outcomeDeltaPct ?? 0) >= 0 ? 'text-primary' : 'text-red-300';
              return (
                <p key={`${outcome.decisionId}-${outcome.horizon}`} className="text-sm text-muted-foreground">
                  <span className="text-white font-semibold">
                    {outcome.decisionType ?? 'decision'} {outcome.assetTicker ?? ''}
                  </span>
                  <span> · {outcome.horizon} · </span>
                  <span className={colorClass}>{deltaSign}{formatPercent(outcome.outcomeDeltaPct)}</span>
                </p>
              );
            })}
            {data.maturedOutcomes.length > 5 && (
              <p className="text-[11px] text-muted-foreground/70">+ {data.maturedOutcomes.length - 5} more</p>
            )}
          </div>
        )}

        {(data.alertHistory.success > 0 || data.alertHistory.failed > 0) && (
          <div className="rounded-lg bg-background px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cron alerts</p>
            <p className="text-sm text-white mt-1">
              <span className="text-primary">{data.alertHistory.success} success</span>
              {data.alertHistory.failed > 0 && (
                <>
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-red-300">{data.alertHistory.failed} failed</span>
                </>
              )}
            </p>
            {data.alertHistory.lastFailureMessage && (
              <p className="text-[11px] text-red-300/80 mt-1 truncate">
                Last failure: {data.alertHistory.lastFailureMessage}
              </p>
            )}
          </div>
        )}

        {data.lastSnapshotComment && (
          <div className="rounded-lg border-l-2 border-primary/60 bg-background/40 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MessageSquare className="w-3 h-3 text-primary" /> Last weekly comment ({data.lastSnapshotComment.snapshotDate})
            </p>
            <p className="text-sm text-white/90 italic mt-1">&ldquo;{data.lastSnapshotComment.comment}&rdquo;</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 2: Type-check

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean. (The component is not yet imported anywhere — that happens in Task 6.)

### Step 3: Commit

```bash
cd /home/lg/dev/Portfolio_Tracker
git add frontend/src/components/friday/SinceLastFridayBriefing.tsx
git diff --cached --stat
```

Expected: 1 file.

```bash
git commit -m "$(cat <<'EOF'
feat(friday): add SinceLastFridayBriefing component

Phase D A1 UI. Renders the "Since Last Friday" card for /friday top.
Severity-grouped sections (regime transitions with amber icon, matured
outcomes list with primary/red deltas, cron alert counts with last
failure preview, snapshot comment italic-quote).

Empty states: dedicated first-run message when no prior snapshot;
"Nothing new" when baseline exists but nothing surfaced.

Wired into FridayDashboard in a follow-on commit on this branch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Frontend — `SleeveHealthPanel` component

**Files:**

- Create: `frontend/src/components/friday/SleeveHealthPanel.tsx`.

### Step 1: Create the component

```tsx
"use client";

import { Activity } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SleeveHistoryData, WeeklyReport } from '@/lib/api';


const SLEEVES: Array<keyof SleeveHistoryData> = ['NDX', 'DBMF', 'BRAZIL', 'MSTR', 'GLDM', 'BONDS-CASH'];

interface SleeveHealthPanelProps {
  report: WeeklyReport;
  sleeveHistory: SleeveHistoryData | null;
}

function normalize(label: string): string {
  return label.toUpperCase().replaceAll('-', '').replaceAll('_', '').replaceAll(' ', '');
}

function matchesSleeve(label: string | null | undefined, sleeve: string): boolean {
  if (!label) return false;
  return normalize(label) === normalize(sleeve);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function SleeveHealthPanel({ report, sleeveHistory }: SleeveHealthPanelProps) {
  const targetDeviation = report.portfolioSnapshot.targetDeviation ?? [];
  const triggeredRules = report.triggeredRules ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Sleeve Health
        </CardTitle>
        <CardDescription>Drift, active signals, and 4-week signal recency per sleeve.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {SLEEVES.map((sleeve) => {
          const match = targetDeviation.find((row) => matchesSleeve(row.category, sleeve));
          const activeRules = triggeredRules.filter((rule) =>
            (rule.affectedSleeves ?? []).some((sleeveName) => matchesSleeve(sleeveName, sleeve)),
          );
          const recency = sleeveHistory?.[sleeve] ?? [0, 0, 0, 0];
          const maxRecency = Math.max(1, ...recency);

          const driftPct = match ? match.deviation : null;
          const driftColor =
            driftPct == null ? 'bg-muted-foreground/40'
              : Math.abs(driftPct) > 0.05 ? 'bg-red-400'
              : Math.abs(driftPct) > 0.02 ? 'bg-amber-400'
              : 'bg-primary';

          return (
            <div key={sleeve} className="grid grid-cols-12 items-center gap-3 rounded-lg bg-background px-4 py-3 text-sm">
              <p className="col-span-2 font-semibold text-white">{sleeve}</p>

              <p className="col-span-2 text-xs text-muted-foreground">
                {formatPercent(match?.currentWeight)} / {formatPercent(match?.targetWeight)}
              </p>

              <div className="col-span-2">
                <div className={`h-1.5 rounded-full ${driftColor}`} style={{ width: match ? `${Math.min(100, Math.abs((driftPct ?? 0) * 400))}%` : '8%' }} />
              </div>

              <div className="col-span-2 text-xs">
                {activeRules.length > 0 ? (
                  <span className="text-amber-300">{activeRules.length} rule{activeRules.length === 1 ? '' : 's'}</span>
                ) : (
                  <span className="text-muted-foreground">quiet</span>
                )}
              </div>

              <div className="col-span-4 flex items-end gap-0.5 h-6">
                {recency.map((count, idx) => (
                  <div
                    key={idx}
                    className={`flex-1 rounded-sm ${count > 0 ? 'bg-primary/80' : 'bg-muted-foreground/20'}`}
                    style={{ height: `${Math.max(10, (count / maxRecency) * 100)}%` }}
                    title={`Week ${idx + 1}: ${count} rule firing${count === 1 ? '' : 's'}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

### Step 2: Type-check

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit 2>&1 | tail -10
```

Expected: clean.

### Step 3: Commit

```bash
cd /home/lg/dev/Portfolio_Tracker
git add frontend/src/components/friday/SleeveHealthPanel.tsx
git diff --cached --stat
```

Expected: 1 file.

```bash
git commit -m "$(cat <<'EOF'
feat(friday): add SleeveHealthPanel component

Phase D A2 UI. Renders the 6-row Sleeve Health panel for /friday.
Each row: sleeve label | current% / target% | drift bar | active
signals count | 4-week recency mini-bars.

Current/target/drift use fuzzy-match against targetDeviation.category
(case- and punctuation-insensitive); unmatched sleeves render em-dash
placeholders rather than block the rest of the panel.

Signal count uses the same fuzzy match against triggeredRules[i]
.affectedSleeves. Recency strip consumes SleeveHistoryData from the
backend sleeve-history endpoint.

Wired into FridayDashboard in a follow-on commit on this branch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Integration — page fetch + FridayDashboard wiring

**Files:**

- Modify: `frontend/src/app/friday/page.tsx`.
- Modify: `frontend/src/components/friday/FridayDashboard.tsx`.

### Step 1: Extend the page data fetch

Replace `frontend/src/app/friday/page.tsx` with:

```tsx
import { FridayDashboard } from '@/components/friday/FridayDashboard';
import {
  getFridayBriefing,
  getFridayCurrent,
  getFridaySleeveHistory,
  getFridaySnapshot,
  getFridaySnapshots,
} from '@/lib/api';


export default async function FridayPage() {
  const [report, snapshots, briefing, sleeveHistory] = await Promise.all([
    getFridayCurrent(),
    getFridaySnapshots(),
    getFridayBriefing(),
    getFridaySleeveHistory(4),
  ]);

  if (!report) {
    return (
      <div className="space-y-4 p-8 text-white">
        <h1 className="text-2xl font-bold italic">Unable to load Friday data</h1>
        <p className="text-sm text-muted-foreground">The Friday backend data is unavailable right now. Check backend connectivity and try again.</p>
      </div>
    );
  }

  const currentSnapshot = snapshots.some((item) => item.snapshotDate === report.weekEnding)
    ? await getFridaySnapshot(report.weekEnding)
    : null;

  return (
    <FridayDashboard
      report={report}
      snapshots={snapshots}
      currentSnapshot={currentSnapshot}
      briefing={briefing}
      sleeveHistory={sleeveHistory}
    />
  );
}
```

### Step 2: Accept the new props in FridayDashboard

In `frontend/src/components/friday/FridayDashboard.tsx`, locate the top import block (around line 10) and update the type imports:

```typescript
import type { FridayBriefingData, FridaySnapshot, FridaySnapshotSummary, SleeveHistoryData, WeeklyReport } from '@/lib/api';
```

Also add the new component imports right below (around line 12, after the `createFridayDecision` import):

```typescript
import { SinceLastFridayBriefing } from '@/components/friday/SinceLastFridayBriefing';
import { SleeveHealthPanel } from '@/components/friday/SleeveHealthPanel';
```

Then update the `FridayDashboardProps` interface (around line 27-31). Replace:

```typescript
interface FridayDashboardProps {
  report: WeeklyReport;
  snapshots: FridaySnapshotSummary[];
  currentSnapshot: FridaySnapshot | null;
}
```

with:

```typescript
interface FridayDashboardProps {
  report: WeeklyReport;
  snapshots: FridaySnapshotSummary[];
  currentSnapshot: FridaySnapshot | null;
  briefing: FridayBriefingData | null;
  sleeveHistory: SleeveHistoryData | null;
}
```

And update the destructuring (around line 33):

```typescript
export function FridayDashboard({ report, snapshots, currentSnapshot, briefing, sleeveHistory }: FridayDashboardProps) {
```

### Step 3: Render the two new components at correct positions

The `return` statement begins around line 112 with `<div className="space-y-8 animate-in fade-in duration-500 pb-12">`. The first child is the header flex block (ending around line 129).

Immediately AFTER that header `</div>` closes (around line 129), INSERT:

```tsx
      <SinceLastFridayBriefing data={briefing} />
```

That places the A1 briefing card at `/friday` top, above the hero strip.

Next, locate the hero-strip grid (`<div className="grid gap-4 xl:grid-cols-5">`, around line 131). It closes on its own line around line 177. Immediately AFTER that closing `</div>`, INSERT:

```tsx
      <SleeveHealthPanel report={report} sleeveHistory={sleeveHistory} />
```

This places the A2 panel between the hero strip and the existing 2-column explore zone.

### Step 4: Type-check + lint + build

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit && echo TS-OK && npm run lint 2>&1 | tail -5 && npm run build 2>&1 | tail -5
```

Expected: all clean. Build completes with 15 or more static pages generated.

### Step 5: Commit

```bash
cd /home/lg/dev/Portfolio_Tracker
git add frontend/src/app/friday/page.tsx frontend/src/components/friday/FridayDashboard.tsx
git diff --cached --stat
```

Expected: 2 files.

```bash
git commit -m "$(cat <<'EOF'
feat(friday): wire SinceLastFridayBriefing + SleeveHealthPanel into /friday

Phase D A1 + A2 integration. Page-level data fetch in
frontend/src/app/friday/page.tsx parallelizes the two new endpoints
with the existing getFridayCurrent / getFridaySnapshots calls. The
new components sit at the DESIGN.md-specified positions:

- SinceLastFridayBriefing — above the hero strip (Friday Hierarchy
  item 1).
- SleeveHealthPanel — between the hero strip and the existing
  Portfolio delta / Macro regime explore zone (Friday Hierarchy
  item 3).

Both components accept `null` data gracefully (empty-state cards),
so a backend hiccup does not block the rest of the page from
rendering.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full backend suite green**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m pytest 2>&1 | tail -5
```

Expected: 68 passed.

- [ ] **Step 2: Frontend gates clean**

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit && npm run lint && npm run build
```

Expected: exit 0 on all three.

- [ ] **Step 3: Manual smoke (local dev)**

Start both servers:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m uvicorn app.main:app --reload --port 8000 &
cd /home/lg/dev/Portfolio_Tracker/frontend && npm run dev &
```

Navigate to `http://localhost:3000/friday`. Verify:

- Page loads without console errors.
- "Since Last Friday" card renders at the top. If no prior snapshot in the DB, shows the empty-state message. If there is one, shows whichever sections have content.
- "Sleeve Health" panel renders 6 rows between the hero strip and the portfolio delta zone. Each row shows label + placeholder or real percent + drift bar + signal count + recency strip.
- Existing sections (hero strip, portfolio delta, signals, macro, decision journal, archive links) are unchanged.
- DevTools Network tab shows 2 new requests: `/api/v1/friday/briefing` and `/api/v1/friday/sleeve-history?weeks=4`. Both 200.

Kill servers when done:

```bash
pkill -f "uvicorn app.main:app"
pkill -f "next dev"
```

- [ ] **Step 4: Branch state**

```bash
cd /home/lg/dev/Portfolio_Tracker && git log --oneline main..HEAD
```

Expected: 6 commits (Tasks 1-6; Task 7 adds no new commits).

- [ ] **Step 5: Do NOT push in this task.** The `finishing-a-development-branch` skill handles the merge / push decision.

---

## Self-Review Checklist

- [x] Every task has exact file paths and line anchors where stable.
- [x] Every content block is complete (no TBD / implement later).
- [x] TDD discipline: Tasks 1-2 write tests first (backend); Tasks 3-6 use type-check + lint + build + manual smoke (no frontend test harness in this repo).
- [x] Scope strictly matches user ask: A1 + A2 only. No Discord echo, no legacy alias cleanup, no deferred items.
- [x] No schema change, no Alembic revision.
- [x] Types consistent: `FridayBriefingData` / `SleeveHistoryData` spelled identically in api.ts, SinceLastFridayBriefing, SleeveHealthPanel, FridayDashboard, page.tsx.
- [x] Sleeve labels consistent: `SLEEVES` list in `briefing_service.py` matches the `SLEEVES` list in `SleeveHealthPanel.tsx` matches the `SleeveHistoryData` keys.
- [x] No secrets, no .env changes, no prod DB operations.
- [x] Graceful degradation: null briefing / null sleeveHistory / missing targetDeviation entry all render empty states rather than crash.
