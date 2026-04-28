"""Read-model composer for /api/intelligence/macro-context.

Composition only — never recomputes scoring rules, never persists.
Sibling to a future PredictionService that will own forward-looking
expectation reads (Phase 2, deferred to office-hours)."""

from __future__ import annotations

from typing import Any, Dict

from sqlalchemy.orm import Session

from ..data.macro_indicator_meta import INDICATOR_META, META_LOGIC_VERSION
from .intelligence_service import IntelligenceService
from .macro_service import MacroService
from .portfolio_service import PortfolioService
from .score_service import (
    CATEGORY_TARGETS,
    ScoreService,
    compute_alignment_score,
    compute_posture_diversification_score,
)
from .score_rules import RULES_LOGIC_VERSION


class MacroContextService:

    @staticmethod
    def _attach_meta(indicators: list[dict]) -> list[dict]:
        out: list[dict] = []
        for ind in indicators:
            meta = INDICATOR_META.get(ind.get("key"))
            if meta is None:
                out.append(ind)
                continue
            out.append({
                **ind,
                "definition": meta.definition,
                "methodology": meta.methodology,
                "whyItMatters": meta.why_it_matters,
                "leadLagTier": meta.lead_lag_tier,
                "thresholdRationale": meta.threshold_rationale,
                "thresholdRationaleSource": meta.threshold_rationale_source,
                "coreIndicator": meta.core_indicator,
                "signalAsymmetry": meta.signal_asymmetry,
                "persistenceWeeks": meta.persistence_weeks,
                "refreshFrequency": meta.refresh_frequency,
            })
        return out

    @staticmethod
    def _build_causal_map(snapshot: dict, score_explain: dict) -> dict:
        return {
            "bucketRules": [
                {
                    "bucket": b["bucket"],
                    "state": b["state"],
                    "points": b["points"],
                    "narrative": b["narrative"],
                    "rule": b["rule"],
                }
                for b in score_explain["buckets"]
            ],
            "currentBucketStates": [
                {"bucket": b["bucket"], "state": b["state"], "confidence": b.get("confidence")}
                for b in snapshot.get("buckets", [])
            ],
            "sleeveImpacts": [
                {"bucket": b["bucket"], "sleeves": b["sleeveProjection"]}
                for b in score_explain["buckets"]
            ],
        }

    @staticmethod
    def _build_positioning(allocation: list, score_explain: dict) -> dict:
        most_adverse = next(
            (b for b in score_explain["buckets"] if b["state"] == "adverse"),
            score_explain["buckets"][0] if score_explain["buckets"] else None,
        )
        sleeves = most_adverse["sleeveProjection"] if most_adverse else []
        return {
            "sleeves": sleeves if sleeves else [
                {"sleeve": s, "currentWeight": 0.0, "targetWeight": t, "compatibilityBand": "in", "contributingFactors": {}}
                for s, t in CATEGORY_TARGETS.items()
            ],
            "bands": [
                {"band": "below", "meaning": "Sleeve under-allocated for current macro stance"},
                {"band": "in", "meaning": "Sleeve allocation aligned with current macro stance"},
                {"band": "above", "meaning": "Sleeve over-allocated for current macro stance"},
            ],
        }

    @staticmethod
    def _build_performance(score_explain: dict, alignment: dict, posture: dict, trends: list) -> dict:
        last = trends[-1] if trends else None
        prior = trends[-2] if len(trends) >= 2 else None
        avg_window = trends[-4:] if trends else []
        avg_total = (sum(r["totalScore"] for r in avg_window if r["totalScore"] is not None) / len(avg_window)) if avg_window else None

        def _delta(curr: int | None, ref: int | None) -> int | None:
            if curr is None or ref is None:
                return None
            return curr - ref

        return {
            "fit": {
                "score": score_explain["totalFit"],
                "max": 30,
                "deltaVsPriorWeek": _delta(score_explain["totalFit"], prior["fitScore"] if prior else None),
            },
            "alignment": {
                "score": alignment["score"],
                "max": 30,
                "deltaVsPriorWeek": _delta(alignment["score"], prior["alignmentScore"] if prior else None),
            },
            "posture": {
                "score": posture["score"],
                "max": 40,
                "deltaVsPriorWeek": _delta(posture["score"], prior["postureScore"] if prior else None),
            },
            "trends": trends,
            "avgTotalLast4Weeks": int(avg_total) if avg_total is not None else None,
            "lastTotal": last["totalScore"] if last else None,
        }

    @staticmethod
    def get_macro_context(db: Session) -> dict:
        snapshot = MacroService.get_macro_snapshot_cached(db)
        allocation = PortfolioService.get_portfolio_allocation(db)
        score_explain = ScoreService.explain_fit(snapshot, allocation)
        alignment = compute_alignment_score(allocation)
        posture = compute_posture_diversification_score(db, allocation)
        trends = IntelligenceService.get_attribution_history(db, weeks=26)

        return {
            "indicators": MacroContextService._attach_meta(snapshot.get("indicators", [])),
            "causalMap": MacroContextService._build_causal_map(snapshot, score_explain),
            "positioning": MacroContextService._build_positioning(allocation, score_explain),
            "performance": MacroContextService._build_performance(score_explain, alignment, posture, trends),
            "logicVersion": {"rules": RULES_LOGIC_VERSION, "meta": META_LOGIC_VERSION},
            "knownAsOf": snapshot.get("knownAsOf"),
        }

    @staticmethod
    def get_macro_context_safe(db: Session) -> dict:
        """Empty-state-shaped fallback when upstream fetch errors. Same envelope
        structure with empty arrays / null leaves so frontend skeleton == loaded."""
        return {
            "indicators": [],
            "causalMap": {"bucketRules": [], "currentBucketStates": [], "sleeveImpacts": []},
            "positioning": {
                "sleeves": [
                    {"sleeve": s, "currentWeight": 0.0, "targetWeight": t, "compatibilityBand": "in", "contributingFactors": {}}
                    for s, t in CATEGORY_TARGETS.items()
                ],
                "bands": [],
            },
            "performance": {
                "fit": None,
                "alignment": None,
                "posture": None,
                "trends": [],
                "avgTotalLast4Weeks": None,
                "lastTotal": None,
            },
            "logicVersion": {"rules": RULES_LOGIC_VERSION, "meta": META_LOGIC_VERSION},
            "knownAsOf": None,
        }
