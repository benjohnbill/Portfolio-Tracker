from __future__ import annotations

from typing import Any, Dict, List, Tuple

from sqlalchemy.orm import Session

from .portfolio_service import PortfolioService
from .score_rules import FIT_RULES, FitRuleSpec, ThresholdPredicate
from .stress_service import StressService


CATEGORY_TARGETS: Dict[str, float] = {
    "NDX": 0.30,
    "DBMF": 0.30,
    "BRAZIL": 0.10,
    "MSTR": 0.10,
    "GLDM": 0.10,
    "BONDS/CASH": 0.10,
}


def asset_to_category(symbol: str) -> str:
    s = (symbol or "").upper()
    if s == "NDX" or any(token in s for token in ["NDX_", "KODEX_1X", "KODEX1X", "TIGER"]):
        return "NDX"
    if "DBMF" in s:
        return "DBMF"
    if "BRAZIL" in s:
        return "BRAZIL"
    if "MSTR" in s:
        return "MSTR"
    if "GLDM" in s or "GLD" in s:
        return "GLDM"
    if any(token in s for token in ["TLT", "BIL", "VBIL", "IEF"]):
        return "BONDS/CASH"
    return "OTHER"


def _bucket_label(score: float, max_score: float) -> str:
    if score >= max_score:
        return "aligned"
    if score >= max_score / 2:
        return "partial"
    return "misaligned"


def _build_exposures(allocation: List[Dict[str, Any]]) -> Dict[str, float]:
    exposures = {
        "risk_beta": 0.0,
        "duration": 0.0,
        "inflation_defense": 0.0,
        "diversifier": 0.0,
        "reserve": 0.0,
    }

    for item in allocation:
        weight = float(item.get("weight", 0.0) or 0.0)
        symbol = item.get("asset", "")
        category = asset_to_category(symbol)

        if category == "NDX":
            exposures["risk_beta"] += weight
        elif category == "MSTR":
            exposures["risk_beta"] += weight
        elif category == "BRAZIL":
            exposures["risk_beta"] += weight * 0.5
            exposures["duration"] += weight * 0.3
            exposures["diversifier"] += weight * 0.2
        elif category == "DBMF":
            exposures["diversifier"] += weight
        elif category == "GLDM":
            exposures["inflation_defense"] += weight
        elif category == "BONDS/CASH":
            upper = symbol.upper()
            if "BIL" in upper:
                exposures["reserve"] += weight
            else:
                exposures["duration"] += weight
                exposures["reserve"] += weight * 0.35
        else:
            exposures["risk_beta"] += weight * 0.5

    return exposures


def compute_alignment_score(allocation: List[Dict[str, Any]]) -> Dict[str, Any]:
    current_weights: Dict[str, float] = {}
    for item in allocation:
        category = asset_to_category(item.get("asset", ""))
        if category == "OTHER":
            continue
        current_weights[category] = current_weights.get(category, 0.0) + float(item.get("weight", 0.0) or 0.0)

    category_breakdown: List[Dict[str, Any]] = []
    total_score = 0.0
    needs_rebalance = False

    for category, target in CATEGORY_TARGETS.items():
        current = current_weights.get(category, 0.0)
        drift = abs(current - target) / target if target > 0 else 0.0
        max_points = 30 * target
        if drift <= 0.10:
            score = max_points
        elif drift <= 0.30:
            score = max_points * 0.5
        else:
            score = 0.0
            needs_rebalance = True

        category_breakdown.append({
            "category": category,
            "currentWeight": round(current, 4),
            "targetWeight": round(target, 4),
            "deviation": round((current - target) / target if target > 0 else 0.0, 4),
            "needsRebalance": drift > 0.30,
            "score": round(score, 2),
            "max": round(max_points, 2),
        })
        total_score += score

    return {
        "score": round(total_score),
        "max": 30,
        "needsRebalance": needs_rebalance,
        "categories": category_breakdown,
    }


_LEGACY_BUCKET_RENAME = {"Liquidity": "Liquidity/FCI"}


def _exposure_value(field: str, exposures: Dict[str, float]) -> float:
    if field == "diversifier_reserve":
        return exposures["diversifier"] + exposures["reserve"]
    return exposures[field]


def _check_predicate(p: ThresholdPredicate, exposures: Dict[str, float]) -> bool:
    value = _exposure_value(p.field, exposures)
    if p.op == ">=":
        return value >= p.value
    if p.op == "<=":
        return value <= p.value
    if p.op == ">":
        return value > p.value
    if p.op == "<":
        return value < p.value
    if p.op == "between":
        low, high = p.value  # type: ignore[misc]
        return low <= value <= high
    raise ValueError(f"Unknown predicate op: {p.op}")


def _check_all(predicates: List[ThresholdPredicate], exposures: Dict[str, float]) -> bool:
    return all(_check_predicate(p, exposures) for p in predicates)


def _lookup_fit_rule(bucket: str, state: str) -> FitRuleSpec:
    canonical_bucket = _LEGACY_BUCKET_RENAME.get(bucket, bucket)
    for rule in FIT_RULES:
        if rule.bucket == canonical_bucket and rule.state == state:
            return rule
    raise KeyError(f"No FIT_RULES entry for bucket={bucket!r} state={state!r}")


def _score_fit_bucket(bucket: str, state: str, exposures: Dict[str, float]) -> Tuple[int, str]:
    rule = _lookup_fit_rule(bucket, state)
    if rule.predicates_full and _check_all(rule.predicates_full, exposures):
        return rule.points_full_match, rule.narrative_full
    if rule.predicates_partial and _check_all(rule.predicates_partial, exposures):
        return rule.points_partial_match, rule.narrative_partial
    return rule.points_miss, rule.narrative_miss


def compute_fit_score(macro_snapshot: Dict[str, Any], allocation: List[Dict[str, Any]]) -> Dict[str, Any]:
    exposures = _build_exposures(allocation)
    bucket_breakdown: List[Dict[str, Any]] = []
    total = 0
    positives: List[str] = []
    negatives: List[str] = []

    for bucket in macro_snapshot.get("buckets", []):
        name = bucket.get("bucket", "Unknown")
        state = bucket.get("state", "neutral")
        score, explanation = _score_fit_bucket(name, state, exposures)
        bucket_breakdown.append({
            "name": f"{name} Fit",
            "score": score,
            "max": 6,
            "state": _bucket_label(score, 6),
            "explanation": explanation,
        })
        total += score
        if score >= 6:
            positives.append(explanation)
        elif score <= 0:
            negatives.append(explanation)

    return {
        "score": total,
        "max": 30,
        "bucketBreakdown": bucket_breakdown,
        "positives": positives,
        "negatives": negatives,
        "exposures": {key: round(value, 4) for key, value in exposures.items()},
    }


def compute_posture_diversification_score(db: Session, allocation: List[Dict[str, Any]]) -> Dict[str, Any]:
    exposures = _build_exposures(allocation)
    weights_by_symbol = {
        item["asset"]: float(item.get("weight", 0.0) or 0.0)
        for item in allocation
        if float(item.get("weight", 0.0) or 0.0) > 0
    }
    sorted_weights = sorted(weights_by_symbol.values(), reverse=True)
    top1 = sorted_weights[0] if sorted_weights else 0.0
    top2 = sum(sorted_weights[:2]) if len(sorted_weights) >= 2 else top1
    hhi = sum(weight * weight for weight in weights_by_symbol.values())

    stress_results = StressService.run_simulation(weights_by_symbol) if weights_by_symbol else []
    worst_return = min((item.get("portfolio", {}).get("return", 0.0) for item in stress_results), default=0.0)
    worst_mdd = min((item.get("portfolio", {}).get("mdd", 0.0) for item in stress_results), default=0.0)

    # Stress Resilience (0-20)
    if worst_return >= -15 and worst_mdd >= -20:
        stress_score = 20
    elif worst_return >= -25 and worst_mdd >= -35:
        stress_score = 12
    else:
        stress_score = 4

    # Concentration Control (0-12)
    if top1 <= 0.25 and top2 <= 0.45 and round(hhi, 6) <= 0.18:
        concentration_score = 12
    elif top1 <= 0.35 and top2 <= 0.60:
        concentration_score = 7
    else:
        concentration_score = 2

    # Diversifier Reserve (0-8)
    reserve_diversifier = exposures["reserve"] + exposures["diversifier"]
    if reserve_diversifier >= 0.15:
        diversifier_score = 8
    elif reserve_diversifier >= 0.05:
        diversifier_score = 5
    else:
        diversifier_score = 0

    return {
        "score": stress_score + concentration_score + diversifier_score,
        "max": 40,
        "stressResilience": {
            "score": stress_score,
            "max": 20,
            "worstReturn": worst_return,
            "worstMdd": worst_mdd,
            "scenarios": stress_results,
        },
        "concentrationControl": {
            "score": concentration_score,
            "max": 12,
            "top1Weight": round(top1, 4),
            "top2Weight": round(top2, 4),
            "hhi": round(hhi, 4),
        },
        "diversifierReserve": {
            "score": diversifier_score,
            "max": 8,
            "weight": round(reserve_diversifier, 4),
        },
    }


def build_target_deviation(allocation: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return compute_alignment_score(allocation)["categories"]


class ScoreService:
    """Class-form facade. Existing free functions remain the implementation;
    this class adds the explain_fit read-model and namespacing for new
    surfaces (MacroContextService consumes ScoreService.explain_fit)."""

    compute_fit_score = staticmethod(compute_fit_score)
    compute_alignment_score = staticmethod(compute_alignment_score)
    compute_posture_diversification_score = staticmethod(compute_posture_diversification_score)
    asset_to_category = staticmethod(asset_to_category)

    @staticmethod
    def _project_to_sleeves(rule: FitRuleSpec, allocation: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Sleeve-level compatibility band derivation from SLEEVE_FACTOR_MAP.

        Read-only projection — not a normative target. The band reflects
        whether the sleeve's contributing factors align with the matched
        FitRuleSpec direction.
        """
        from .score_rules import SLEEVE_FACTOR_MAP
        weights_by_category: Dict[str, float] = {}
        for item in allocation:
            cat = asset_to_category(item.get("asset", ""))
            if cat == "OTHER":
                continue
            weights_by_category[cat] = weights_by_category.get(cat, 0.0) + float(item.get("weight", 0.0) or 0.0)

        if rule.state == "supportive":
            direction = +1
        elif rule.state == "adverse":
            direction = -1
        else:
            direction = 0

        sleeves: List[Dict[str, Any]] = []
        for sleeve, factors in SLEEVE_FACTOR_MAP.items():
            current = weights_by_category.get(sleeve, 0.0)
            target = CATEGORY_TARGETS.get(sleeve, 0.0)
            score_for_sleeve = sum(factors.values())
            if direction == 0 or target <= 0:
                band = "in"
            elif direction * score_for_sleeve > 0:
                drift = (current - target) / target
                if drift < -0.10:
                    band = "below"
                elif drift > 0.10:
                    band = "above"
                else:
                    band = "in"
            else:
                drift = (current - target) / target
                if drift > 0.10:
                    band = "above"
                elif drift < -0.10:
                    band = "below"
                else:
                    band = "in"
            sleeves.append({
                "sleeve": sleeve,
                "currentWeight": round(current, 4),
                "targetWeight": round(target, 4),
                "compatibilityBand": band,
                "contributingFactors": factors,
            })
        return sleeves

    @staticmethod
    def explain_fit(snapshot: Dict[str, Any], allocation: List[Dict[str, Any]]) -> Dict[str, Any]:
        exposures = _build_exposures(allocation)
        bucket_results: List[Dict[str, Any]] = []
        for bucket_state in snapshot.get("buckets", []):
            bucket_name = bucket_state.get("bucket", "Unknown")
            state = bucket_state.get("state", "neutral")
            try:
                rule = _lookup_fit_rule(bucket_name, state)
            except KeyError:
                continue
            points, narrative = _score_fit_bucket(bucket_name, state, exposures)
            bucket_results.append({
                "bucket": rule.bucket,
                "state": state,
                "points": points,
                "narrative": narrative,
                "rule": {
                    "predicatesFull": [{"field": p.field, "op": p.op, "value": p.value} for p in rule.predicates_full],
                    "predicatesPartial": [{"field": p.field, "op": p.op, "value": p.value} for p in rule.predicates_partial],
                    "pointsFullMatch": rule.points_full_match,
                    "pointsPartialMatch": rule.points_partial_match,
                    "pointsMiss": rule.points_miss,
                },
                "sleeveProjection": ScoreService._project_to_sleeves(rule, allocation),
            })
        return {
            "totalFit": sum(r["points"] for r in bucket_results),
            "buckets": bucket_results,
            "exposureAggregates": {k: round(v, 4) for k, v in exposures.items()},
        }
