"""Attribution Engine — Layer 1 ETL.

Decomposes frozen_report JSONB into first-class queryable columns in
scoring_attributions, and evaluates was_followed via transaction matching.
"""
from __future__ import annotations

import logging
from datetime import date, time as dt_time, timedelta, datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ..models import (
    Asset,
    DecisionOutcome,
    PortfolioSnapshot,
    ScoringAttribution,
    Transaction,
    WeeklyDecision,
    WeeklySnapshot,
)
from .score_service import asset_to_category

logger = logging.getLogger(__name__)

# Bucket name in frozen_report -> column suffix
_BUCKET_MAP: Dict[str, str] = {
    "Liquidity Fit": "liquidity",
    "Rates Fit": "rates",
    "Inflation Fit": "inflation",
    "Growth/Labor Fit": "growth",
    "Stress Fit": "stress",
}

# Alignment category -> column suffix
_ALIGNMENT_MAP: Dict[str, str] = {
    "NDX": "ndx",
    "DBMF": "dbmf",
    "BRAZIL": "brazil",
    "MSTR": "mstr",
    "GLDM": "gldm",
    "BONDS/CASH": "bonds_cash",
}


class AttributionService:

    # ------------------------------------------------------------------
    # AE-003: Layer 1 ETL — extract scores from frozen_report
    # ------------------------------------------------------------------

    @staticmethod
    def extract_attribution(snapshot: WeeklySnapshot) -> Optional[ScoringAttribution]:
        """Parse frozen_report JSONB and return a (not-yet-committed) ScoringAttribution."""
        report = snapshot.frozen_report or {}
        score_section = report.get("score")
        if not score_section:
            logger.warning("Snapshot %s has no score section — skipping attribution", snapshot.id)
            return None

        fit_score = score_section.get("fit", 0)
        alignment_score = score_section.get("alignment", 0)
        posture_score = score_section.get("postureDiversification", 0)
        total_score = score_section.get("total", 0)

        # Fit bucket breakdown
        bucket_scores: Dict[str, float] = {}
        for bucket in score_section.get("bucketBreakdown", []):
            name = bucket.get("name", "")
            suffix = _BUCKET_MAP.get(name)
            if suffix:
                bucket_scores[suffix] = bucket.get("score", 0)

        # Alignment per-category from targetDeviation
        portfolio_snapshot = report.get("portfolioSnapshot", {})
        alignment_categories: Dict[str, float] = {}
        for cat in portfolio_snapshot.get("targetDeviation", []):
            category = cat.get("category", "")
            suffix = _ALIGNMENT_MAP.get(category)
            if suffix:
                alignment_categories[suffix] = cat.get("score", 0)

        # Regime snapshot from macroSnapshot.buckets
        macro = report.get("macroSnapshot", {})
        regime_snapshot = macro.get("buckets")

        # Indicator values from signalsSnapshot
        indicator_values = report.get("signalsSnapshot")

        # Posture sub-scores (added in postureBreakdown, null for older reports)
        posture_breakdown = score_section.get("postureBreakdown", {}) or {}

        # Triggered rules (was_followed initially null)
        rules_fired = report.get("triggeredRules")

        return ScoringAttribution(
            snapshot_id=snapshot.id,
            fit_score=fit_score,
            fit_bucket_liquidity=bucket_scores.get("liquidity"),
            fit_bucket_rates=bucket_scores.get("rates"),
            fit_bucket_inflation=bucket_scores.get("inflation"),
            fit_bucket_growth=bucket_scores.get("growth"),
            fit_bucket_stress=bucket_scores.get("stress"),
            alignment_score=alignment_score,
            alignment_ndx=alignment_categories.get("ndx"),
            alignment_dbmf=alignment_categories.get("dbmf"),
            alignment_brazil=alignment_categories.get("brazil"),
            alignment_mstr=alignment_categories.get("mstr"),
            alignment_gldm=alignment_categories.get("gldm"),
            alignment_bonds_cash=alignment_categories.get("bonds_cash"),
            posture_score=posture_score,
            posture_stress_resilience=posture_breakdown.get("stressResilience"),
            posture_concentration=posture_breakdown.get("concentrationControl"),
            posture_diversifier_reserve=posture_breakdown.get("diversifierReserve"),
            total_score=total_score,
            regime_snapshot=regime_snapshot,
            indicator_values=indicator_values,
            rules_fired=rules_fired,
        )

    # ------------------------------------------------------------------
    # AE-004: was_followed via transaction matching
    # ------------------------------------------------------------------

    @staticmethod
    def evaluate_was_followed(
        db: Session,
        attribution: ScoringAttribution,
        snapshot_date: date,
    ) -> None:
        """Check transactions within 7 days after snapshot_date to determine
        whether each triggered rule was actually followed."""
        rules = attribution.rules_fired
        if not rules:
            return

        window_start = snapshot_date
        window_end = snapshot_date + timedelta(days=7)

        # Pre-fetch transactions in the window
        txns = (
            db.query(Transaction)
            .filter(
                Transaction.date >= datetime.combine(window_start, dt_time()),
                Transaction.date < datetime.combine(window_end + timedelta(days=1), dt_time()),
            )
            .all()
        )
        if not txns:
            # No transaction data → leave was_followed as null
            return

        # Build asset_id -> symbol lookup
        asset_ids = {t.asset_id for t in txns}
        assets = db.query(Asset).filter(Asset.id.in_(asset_ids)).all()
        asset_map = {a.id: a.symbol for a in assets}

        # Build category -> set of transaction types in window
        category_actions: Dict[str, set] = {}
        for txn in txns:
            symbol = asset_map.get(txn.asset_id, "")
            cat = asset_to_category(symbol)
            if cat not in category_actions:
                category_actions[cat] = set()
            category_actions[cat].add(txn.type)

        updated_rules: List[Dict[str, Any]] = []
        for rule in rules:
            rule = dict(rule)  # copy to avoid mutating original
            affected = rule.get("affectedSleeves", [])
            action_str = rule.get("message", "") or ""

            # Determine expected transaction type from the source side of the rule.
            # Rules are formatted "SELL X -> BUY Y" — we check the left side of "->"
            # to determine the primary action for the affected asset.
            expected_type = None
            upper_action = action_str.upper()
            left_side = upper_action.split("->")[0] if "->" in upper_action else upper_action
            if "SELL" in left_side:
                expected_type = "SELL"
            elif "BUY" in left_side:
                expected_type = "BUY"

            if affected and expected_type:
                category = affected[0]
                cat_txns = category_actions.get(category, set())
                rule["was_followed"] = expected_type in cat_txns
            # else: leave was_followed absent (null)

            updated_rules.append(rule)

        attribution.rules_fired = updated_rules

    # ------------------------------------------------------------------
    # AE-005: compute_for_snapshot — idempotent orchestrator
    # ------------------------------------------------------------------

    @staticmethod
    def compute_for_snapshot(db: Session, snapshot_id: int) -> Optional[ScoringAttribution]:
        """Compute attribution for a single snapshot. Idempotent — skips if exists."""
        existing = db.query(ScoringAttribution).filter(
            ScoringAttribution.snapshot_id == snapshot_id
        ).first()
        if existing:
            logger.debug("Attribution already exists for snapshot %s — skipping", snapshot_id)
            return None

        snapshot = db.query(WeeklySnapshot).filter(WeeklySnapshot.id == snapshot_id).first()
        if not snapshot:
            logger.warning("Snapshot %s not found", snapshot_id)
            return None

        attribution = AttributionService.extract_attribution(snapshot)
        if not attribution:
            return None

        try:
            AttributionService.evaluate_was_followed(db, attribution, snapshot.snapshot_date)
        except Exception:
            logger.exception("was_followed evaluation failed for snapshot %s — continuing without it", snapshot_id)

        db.add(attribution)
        db.commit()
        db.refresh(attribution)
        logger.info("Created attribution for snapshot %s (total_score=%s)", snapshot_id, attribution.total_score)
        return attribution

    # ------------------------------------------------------------------
    # AE-006 helper: compute_latest (called from cron)
    # ------------------------------------------------------------------

    @staticmethod
    def compute_latest(db: Session) -> Optional[ScoringAttribution]:
        """Find the most recent WeeklySnapshot and compute its attribution."""
        snapshot = db.query(WeeklySnapshot).order_by(WeeklySnapshot.snapshot_date.desc()).first()
        if not snapshot:
            logger.info("No weekly snapshots found — nothing to attribute")
            return None
        return AttributionService.compute_for_snapshot(db, snapshot.id)

    # ------------------------------------------------------------------
    # AE-007: Backfill existing snapshots
    # ------------------------------------------------------------------

    @staticmethod
    def backfill_all(db: Session) -> int:
        """Backfill attributions for all existing WeeklySnapshots."""
        snapshots = db.query(WeeklySnapshot).order_by(WeeklySnapshot.snapshot_date.asc()).all()
        created = 0
        for snapshot in snapshots:
            result = AttributionService.compute_for_snapshot(db, snapshot.id)
            if result:
                created += 1
        logger.info("Backfill complete: %d new attributions created from %d snapshots", created, len(snapshots))
        return created
