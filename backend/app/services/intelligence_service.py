"""Intelligence query service — read-only endpoints for attribution data.

Provides time-series attribution queries, decision outcome lookups,
rule accuracy aggregation, and regime transition history.
Also includes the decision outcome evaluator for the daily cron.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta, datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import (
    DecisionOutcome,
    PortfolioSnapshot,
    ScoringAttribution,
    WeeklyDecision,
    WeeklySnapshot,
)

logger = logging.getLogger(__name__)

# Horizon definitions in days
HORIZON_DAYS: Dict[str, int] = {
    "1w": 7,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
}


class IntelligenceService:

    # ------------------------------------------------------------------
    # Query: Attribution time series
    # ------------------------------------------------------------------

    @staticmethod
    def get_attributions(
        db: Session,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """Return score decompositions across a date range."""
        query = (
            db.query(ScoringAttribution, WeeklySnapshot.snapshot_date)
            .join(WeeklySnapshot, ScoringAttribution.snapshot_id == WeeklySnapshot.id)
            .order_by(WeeklySnapshot.snapshot_date.asc())
        )
        if date_from:
            query = query.filter(WeeklySnapshot.snapshot_date >= date_from)
        if date_to:
            query = query.filter(WeeklySnapshot.snapshot_date <= date_to)

        results = []
        for attr, snap_date in query.all():
            results.append({
                "snapshotDate": snap_date.isoformat(),
                "totalScore": attr.total_score,
                "fit": {
                    "score": attr.fit_score,
                    "liquidity": attr.fit_bucket_liquidity,
                    "rates": attr.fit_bucket_rates,
                    "inflation": attr.fit_bucket_inflation,
                    "growth": attr.fit_bucket_growth,
                    "stress": attr.fit_bucket_stress,
                },
                "alignment": {
                    "score": attr.alignment_score,
                    "ndx": attr.alignment_ndx,
                    "dbmf": attr.alignment_dbmf,
                    "brazil": attr.alignment_brazil,
                    "mstr": attr.alignment_mstr,
                    "gldm": attr.alignment_gldm,
                    "bondsCash": attr.alignment_bonds_cash,
                },
                "posture": {
                    "score": attr.posture_score,
                    "stressResilience": attr.posture_stress_resilience,
                    "concentration": attr.posture_concentration,
                    "diversifierReserve": attr.posture_diversifier_reserve,
                },
                "regimeSnapshot": attr.regime_snapshot,
                "rulesFired": attr.rules_fired,
            })
        return results

    # ------------------------------------------------------------------
    # Query: Single attribution detail
    # ------------------------------------------------------------------

    @staticmethod
    def get_attribution_by_date(
        db: Session,
        snapshot_date: date,
    ) -> Optional[Dict[str, Any]]:
        """Return full attribution breakdown for a specific snapshot date."""
        result = (
            db.query(ScoringAttribution, WeeklySnapshot.snapshot_date)
            .join(WeeklySnapshot, ScoringAttribution.snapshot_id == WeeklySnapshot.id)
            .filter(WeeklySnapshot.snapshot_date == snapshot_date)
            .first()
        )
        if not result:
            return None

        attr, snap_date = result
        return {
            "snapshotDate": snap_date.isoformat(),
            "totalScore": attr.total_score,
            "fit": {
                "score": attr.fit_score,
                "liquidity": attr.fit_bucket_liquidity,
                "rates": attr.fit_bucket_rates,
                "inflation": attr.fit_bucket_inflation,
                "growth": attr.fit_bucket_growth,
                "stress": attr.fit_bucket_stress,
            },
            "alignment": {
                "score": attr.alignment_score,
                "ndx": attr.alignment_ndx,
                "dbmf": attr.alignment_dbmf,
                "brazil": attr.alignment_brazil,
                "mstr": attr.alignment_mstr,
                "gldm": attr.alignment_gldm,
                "bondsCash": attr.alignment_bonds_cash,
            },
            "posture": {
                "score": attr.posture_score,
                "stressResilience": attr.posture_stress_resilience,
                "concentration": attr.posture_concentration,
                "diversifierReserve": attr.posture_diversifier_reserve,
            },
            "regimeSnapshot": attr.regime_snapshot,
            "indicatorValues": attr.indicator_values,
            "rulesFired": attr.rules_fired,
        }

    # ------------------------------------------------------------------
    # Query: Decision outcomes
    # ------------------------------------------------------------------

    @staticmethod
    def get_outcomes(
        db: Session,
        horizon: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Return decision outcomes, optionally filtered by horizon."""
        query = (
            db.query(DecisionOutcome, WeeklyDecision, WeeklySnapshot.snapshot_date)
            .join(WeeklyDecision, DecisionOutcome.decision_id == WeeklyDecision.id)
            .join(WeeklySnapshot, DecisionOutcome.snapshot_id == WeeklySnapshot.id)
            .order_by(WeeklySnapshot.snapshot_date.desc(), DecisionOutcome.horizon)
        )
        if horizon:
            query = query.filter(DecisionOutcome.horizon == horizon)

        results = []
        for outcome, decision, snap_date in query.all():
            results.append({
                "snapshotDate": snap_date.isoformat(),
                "horizon": outcome.horizon,
                "decision": {
                    "type": decision.decision_type,
                    "assetTicker": decision.asset_ticker,
                    "note": decision.note,
                    "confidenceVsSpyRiskadj": decision.confidence_vs_spy_riskadj,
                    "confidenceVsCash": decision.confidence_vs_cash,
                    "confidenceVsSpyPure": decision.confidence_vs_spy_pure,
                    "expectedFailureMode": decision.expected_failure_mode,
                    "triggerThreshold": decision.trigger_threshold,
                },
                "portfolioValueAtDecision": outcome.portfolio_value_at_decision,
                "portfolioValueAtHorizon": outcome.portfolio_value_at_horizon,
                "scoreAtDecision": outcome.score_at_decision,
                "scoreAtHorizon": outcome.score_at_horizon,
                "regimeAtDecision": outcome.regime_at_decision,
                "regimeAtHorizon": outcome.regime_at_horizon,
                "outcomeDeltaPct": outcome.outcome_delta_pct,
                "scoreDelta": outcome.score_delta,
                "regimeChanged": outcome.regime_changed,
                "evaluatedAt": outcome.evaluated_at.isoformat() if outcome.evaluated_at else None,
            })
        return results

    # ------------------------------------------------------------------
    # Query: Rule accuracy
    # ------------------------------------------------------------------

    @staticmethod
    def get_rule_accuracy(db: Session) -> List[Dict[str, Any]]:
        """Aggregate rule accuracy across all attributions."""
        attributions = db.query(ScoringAttribution).all()

        rule_stats: Dict[str, Dict[str, Any]] = {}
        for attr in attributions:
            rules = attr.rules_fired or []
            for rule in rules:
                rule_id = rule.get("ruleId", "UNKNOWN")
                if rule_id not in rule_stats:
                    rule_stats[rule_id] = {
                        "ruleId": rule_id,
                        "severity": rule.get("severity", "medium"),
                        "timesFired": 0,
                        "timesFollowed": 0,
                        "timesIgnored": 0,
                        "timesPending": 0,
                    }
                stats = rule_stats[rule_id]
                stats["timesFired"] += 1
                was_followed = rule.get("was_followed")
                if was_followed is True:
                    stats["timesFollowed"] += 1
                elif was_followed is False:
                    stats["timesIgnored"] += 1
                else:
                    stats["timesPending"] += 1

        results = []
        for rule_id, stats in sorted(rule_stats.items()):
            decided = stats["timesFollowed"] + stats["timesIgnored"]
            stats["followRate"] = round(stats["timesFollowed"] / decided, 4) if decided > 0 else None
            results.append(stats)
        return results

    # ------------------------------------------------------------------
    # Query: Regime transition history
    # ------------------------------------------------------------------

    @staticmethod
    def get_regime_history(db: Session) -> List[Dict[str, Any]]:
        """Return regime transitions timeline with before/after state."""
        attributions = (
            db.query(ScoringAttribution, WeeklySnapshot.snapshot_date)
            .join(WeeklySnapshot, ScoringAttribution.snapshot_id == WeeklySnapshot.id)
            .order_by(WeeklySnapshot.snapshot_date.asc())
            .all()
        )
        if not attributions:
            return []

        transitions: List[Dict[str, Any]] = []
        prev_regimes: Optional[Dict[str, str]] = None
        prev_date: Optional[date] = None

        for attr, snap_date in attributions:
            buckets = attr.regime_snapshot or []
            current_regimes = {}
            for bucket in buckets:
                name = bucket.get("bucket", "")
                state = bucket.get("state", "neutral")
                current_regimes[name] = state

            if prev_regimes is not None:
                for bucket_name, new_state in current_regimes.items():
                    old_state = prev_regimes.get(bucket_name)
                    if old_state and old_state != new_state:
                        transitions.append({
                            "date": snap_date.isoformat(),
                            "bucket": bucket_name,
                            "from": old_state,
                            "to": new_state,
                            "totalScore": attr.total_score,
                            "previousDate": prev_date.isoformat() if prev_date else None,
                        })

            prev_regimes = current_regimes
            prev_date = snap_date

        return transitions

    # ------------------------------------------------------------------
    # Decision Outcome Evaluator (daily cron)
    # ------------------------------------------------------------------

    @staticmethod
    def evaluate_decision_outcomes(db: Session) -> int:
        """Evaluate decision outcomes for all mature horizons.

        For each WeeklyDecision, checks whether any horizon has matured
        (enough time has passed) and creates/updates DecisionOutcome rows
        using portfolio_snapshots for value data.
        """
        decisions = (
            db.query(WeeklyDecision, WeeklySnapshot)
            .join(WeeklySnapshot, WeeklyDecision.snapshot_id == WeeklySnapshot.id)
            .all()
        )
        if not decisions:
            return 0

        created = 0
        now = date.today()

        for decision, snapshot in decisions:
            decision_date = snapshot.snapshot_date
            report = snapshot.frozen_report or {}
            score_section = report.get("score", {})
            portfolio_section = report.get("portfolioSnapshot", {})

            score_at_decision = score_section.get("total")
            value_at_decision = portfolio_section.get("totalValueKRW")

            # Extract regime at decision time
            macro = report.get("macroSnapshot", {})
            buckets = macro.get("buckets", [])
            regime_at_decision = buckets[0].get("state") if buckets else None

            for horizon_key, horizon_days in HORIZON_DAYS.items():
                target_date = decision_date + timedelta(days=horizon_days)

                # Skip if horizon hasn't matured yet
                if target_date > now:
                    continue

                # Skip if already evaluated
                existing = db.query(DecisionOutcome).filter(
                    DecisionOutcome.decision_id == decision.id,
                    DecisionOutcome.horizon == horizon_key,
                ).first()
                if existing and existing.evaluated_at is not None:
                    continue

                # Find closest portfolio_snapshot to target_date
                horizon_snapshot = (
                    db.query(PortfolioSnapshot)
                    .filter(PortfolioSnapshot.date <= target_date)
                    .order_by(PortfolioSnapshot.date.desc())
                    .first()
                )
                if not horizon_snapshot:
                    continue

                value_at_horizon = horizon_snapshot.total_value

                # Find closest weekly_snapshot for score/regime at horizon
                horizon_weekly = (
                    db.query(WeeklySnapshot)
                    .filter(WeeklySnapshot.snapshot_date <= target_date)
                    .order_by(WeeklySnapshot.snapshot_date.desc())
                    .first()
                )
                score_at_horizon = None
                regime_at_horizon = None
                if horizon_weekly:
                    h_report = horizon_weekly.frozen_report or {}
                    score_at_horizon = h_report.get("score", {}).get("total")
                    h_buckets = h_report.get("macroSnapshot", {}).get("buckets", [])
                    regime_at_horizon = h_buckets[0].get("state") if h_buckets else None

                # Compute deltas
                outcome_delta_pct = None
                if value_at_decision and value_at_horizon and value_at_decision > 0:
                    outcome_delta_pct = round(
                        ((value_at_horizon - value_at_decision) / value_at_decision) * 100, 4
                    )

                score_delta = None
                if score_at_decision is not None and score_at_horizon is not None:
                    score_delta = score_at_horizon - score_at_decision

                regime_changed = "false"
                if regime_at_decision and regime_at_horizon:
                    regime_changed = "true" if regime_at_decision != regime_at_horizon else "false"

                if existing:
                    # Update in place
                    existing.portfolio_value_at_decision = value_at_decision
                    existing.portfolio_value_at_horizon = value_at_horizon
                    existing.score_at_decision = score_at_decision
                    existing.score_at_horizon = score_at_horizon
                    existing.regime_at_decision = regime_at_decision
                    existing.regime_at_horizon = regime_at_horizon
                    existing.outcome_delta_pct = outcome_delta_pct
                    existing.score_delta = score_delta
                    existing.regime_changed = regime_changed
                    existing.evaluated_at = datetime.now(timezone.utc)
                else:
                    outcome = DecisionOutcome(
                        decision_id=decision.id,
                        snapshot_id=snapshot.id,
                        horizon=horizon_key,
                        portfolio_value_at_decision=value_at_decision,
                        portfolio_value_at_horizon=value_at_horizon,
                        score_at_decision=score_at_decision,
                        score_at_horizon=score_at_horizon,
                        regime_at_decision=regime_at_decision,
                        regime_at_horizon=regime_at_horizon,
                        outcome_delta_pct=outcome_delta_pct,
                        score_delta=score_delta,
                        regime_changed=regime_changed,
                        evaluated_at=datetime.now(timezone.utc),
                    )
                    db.add(outcome)
                    created += 1

        db.commit()
        logger.info("Decision outcome evaluation: %d new outcomes created", created)
        return created

    # ------------------------------------------------------------------
    # Regime Transition Detection (for Telegram alerts)
    # ------------------------------------------------------------------

    @staticmethod
    def detect_regime_transitions(db: Session) -> List[Dict[str, Any]]:
        """Compare the two most recent attributions and return regime changes."""
        recent = (
            db.query(ScoringAttribution, WeeklySnapshot.snapshot_date)
            .join(WeeklySnapshot, ScoringAttribution.snapshot_id == WeeklySnapshot.id)
            .order_by(WeeklySnapshot.snapshot_date.desc())
            .limit(2)
            .all()
        )
        if len(recent) < 2:
            return []

        current_attr, current_date = recent[0]
        prev_attr, prev_date = recent[1]

        current_buckets = {b.get("bucket", ""): b.get("state", "neutral") for b in (current_attr.regime_snapshot or [])}
        prev_buckets = {b.get("bucket", ""): b.get("state", "neutral") for b in (prev_attr.regime_snapshot or [])}

        transitions = []
        for bucket_name, new_state in current_buckets.items():
            old_state = prev_buckets.get(bucket_name)
            if old_state and old_state != new_state:
                transitions.append({
                    "date": current_date.isoformat(),
                    "bucket": bucket_name,
                    "from": old_state,
                    "to": new_state,
                    "totalScore": current_attr.total_score,
                })
        return transitions

    # ------------------------------------------------------------------
    # Periodic Review Aggregation
    # ------------------------------------------------------------------

    @staticmethod
    def get_review_summary(db: Session) -> Dict[str, Any]:
        """Return available review periods with data counts."""
        attributions = (
            db.query(WeeklySnapshot.snapshot_date)
            .join(ScoringAttribution, ScoringAttribution.snapshot_id == WeeklySnapshot.id)
            .order_by(WeeklySnapshot.snapshot_date.asc())
            .all()
        )
        dates = [r.snapshot_date for r in attributions]
        if not dates:
            return {"totalWeeks": 0, "months": [], "quarters": [], "years": []}

        months = sorted(set(d.strftime("%Y-%m") for d in dates))
        quarters = sorted(set(f"{d.year}-Q{(d.month - 1) // 3 + 1}" for d in dates))
        years = sorted(set(str(d.year) for d in dates))

        return {
            "totalWeeks": len(dates),
            "dateRange": {"from": dates[0].isoformat(), "to": dates[-1].isoformat()},
            "months": months,
            "quarters": quarters,
            "years": years,
        }

    @staticmethod
    def _aggregate_attributions(attributions: list) -> Dict[str, Any]:
        """Compute aggregate stats from a list of (ScoringAttribution, date) tuples."""
        if not attributions:
            return {"count": 0}

        scores = [a.total_score for a, _ in attributions]
        fit_scores = [a.fit_score for a, _ in attributions]
        alignment_scores = [a.alignment_score for a, _ in attributions]
        posture_scores = [a.posture_score for a, _ in attributions]

        # Rule stats
        rule_stats: Dict[str, Dict[str, int]] = {}
        for attr, _ in attributions:
            for rule in (attr.rules_fired or []):
                rid = rule.get("ruleId", "UNKNOWN")
                if rid not in rule_stats:
                    rule_stats[rid] = {"fired": 0, "followed": 0, "ignored": 0}
                rule_stats[rid]["fired"] += 1
                wf = rule.get("was_followed")
                if wf is True:
                    rule_stats[rid]["followed"] += 1
                elif wf is False:
                    rule_stats[rid]["ignored"] += 1

        dates = [d for _, d in attributions]
        return {
            "count": len(scores),
            "dateRange": {"from": dates[0].isoformat(), "to": dates[-1].isoformat()},
            "scores": {
                "avg": round(sum(scores) / len(scores), 1),
                "min": min(scores),
                "max": max(scores),
                "trend": scores[-1] - scores[0] if len(scores) > 1 else 0,
            },
            "fit": {"avg": round(sum(fit_scores) / len(fit_scores), 1)},
            "alignment": {"avg": round(sum(alignment_scores) / len(alignment_scores), 1)},
            "posture": {"avg": round(sum(posture_scores) / len(posture_scores), 1)},
            "ruleStats": [
                {"ruleId": rid, **stats} for rid, stats in sorted(rule_stats.items())
            ],
        }

    @staticmethod
    def get_monthly_review(db: Session, month: str) -> Optional[Dict[str, Any]]:
        """Aggregate attributions for a given month (YYYY-MM format)."""
        try:
            year, mon = month.split("-")
            start = date(int(year), int(mon), 1)
            if int(mon) == 12:
                end = date(int(year) + 1, 1, 1)
            else:
                end = date(int(year), int(mon) + 1, 1)
        except (ValueError, IndexError):
            return None

        rows = (
            db.query(ScoringAttribution, WeeklySnapshot.snapshot_date)
            .join(WeeklySnapshot, ScoringAttribution.snapshot_id == WeeklySnapshot.id)
            .filter(WeeklySnapshot.snapshot_date >= start, WeeklySnapshot.snapshot_date < end)
            .order_by(WeeklySnapshot.snapshot_date.asc())
            .all()
        )
        result = IntelligenceService._aggregate_attributions(rows)
        result["period"] = month
        result["type"] = "monthly"
        return result

    @staticmethod
    def get_quarterly_review(db: Session, quarter: str) -> Optional[Dict[str, Any]]:
        """Aggregate attributions for a given quarter (YYYY-Q1 format)."""
        try:
            year_str, q_str = quarter.split("-Q")
            year = int(year_str)
            q = int(q_str)
            start_month = (q - 1) * 3 + 1
            start = date(year, start_month, 1)
            end_month = start_month + 3
            if end_month > 12:
                end = date(year + 1, end_month - 12, 1)
            else:
                end = date(year, end_month, 1)
        except (ValueError, IndexError):
            return None

        rows = (
            db.query(ScoringAttribution, WeeklySnapshot.snapshot_date)
            .join(WeeklySnapshot, ScoringAttribution.snapshot_id == WeeklySnapshot.id)
            .filter(WeeklySnapshot.snapshot_date >= start, WeeklySnapshot.snapshot_date < end)
            .order_by(WeeklySnapshot.snapshot_date.asc())
            .all()
        )
        result = IntelligenceService._aggregate_attributions(rows)
        result["period"] = quarter
        result["type"] = "quarterly"
        return result

    @staticmethod
    def get_annual_review(db: Session, year: str) -> Optional[Dict[str, Any]]:
        """Aggregate attributions for a given year."""
        try:
            y = int(year)
            start = date(y, 1, 1)
            end = date(y + 1, 1, 1)
        except ValueError:
            return None

        rows = (
            db.query(ScoringAttribution, WeeklySnapshot.snapshot_date)
            .join(WeeklySnapshot, ScoringAttribution.snapshot_id == WeeklySnapshot.id)
            .filter(WeeklySnapshot.snapshot_date >= start, WeeklySnapshot.snapshot_date < end)
            .order_by(WeeklySnapshot.snapshot_date.asc())
            .all()
        )
        result = IntelligenceService._aggregate_attributions(rows)
        result["period"] = year
        result["type"] = "annual"
        return result
