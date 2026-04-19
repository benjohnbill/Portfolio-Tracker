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
