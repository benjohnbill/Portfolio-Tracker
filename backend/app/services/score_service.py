from __future__ import annotations

from typing import Any, Dict, List, Tuple

from sqlalchemy.orm import Session

from .portfolio_service import PortfolioService
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
    if any(token in s for token in ["TIGER", "379810", "KODEX_1X", "KODEX1X"]):
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
        max_points = 35 * target
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
        "max": 35,
        "needsRebalance": needs_rebalance,
        "categories": category_breakdown,
    }


def _score_fit_bucket(bucket: str, state: str, exposures: Dict[str, float]) -> Tuple[int, str]:
    risk_beta = exposures["risk_beta"]
    duration = exposures["duration"]
    inflation_defense = exposures["inflation_defense"]
    diversifier_reserve = exposures["diversifier"] + exposures["reserve"]

    if bucket == "Liquidity":
        if state == "supportive":
            return (8, "Liquidity supports maintaining core risk exposure.") if 0.20 <= risk_beta <= 0.70 else (4, "Liquidity is supportive, but current risk stance is either too defensive or too aggressive.")
        if state == "adverse":
            if diversifier_reserve >= 0.20:
                return 8, "Liquidity is tight, but reserve/diversifier sleeves are meaningful."
            if diversifier_reserve >= 0.10:
                return 4, "Liquidity is tight and reserve coverage is only partial."
            return 0, "Liquidity is adverse while reserve/diversifier sleeves are thin."
        return (8, "Liquidity is neutral and portfolio stance is balanced.") if 0.15 <= risk_beta <= 0.60 else (4, "Liquidity is neutral, but stance leans away from balance.")

    if bucket == "Rates":
        if state == "adverse":
            if duration <= 0.20 and risk_beta <= 0.60:
                return 8, "Adverse rates backdrop is matched by contained duration and beta exposure."
            if duration <= 0.30:
                return 4, "Adverse rates backdrop is only partially matched by current duration posture."
            return 0, "Rates backdrop is adverse while duration exposure remains elevated."
        if state == "supportive":
            return (8, "Supportive rates backdrop allows duration and growth exposure.") if duration >= 0.10 or risk_beta >= 0.25 else (4, "Supportive rates backdrop is not fully utilized.")
        return (8, "Rates backdrop is neutral and posture is balanced.") if duration <= 0.35 else (4, "Rates backdrop is neutral, but duration is elevated.")

    if bucket == "Inflation":
        if state == "adverse":
            if inflation_defense >= 0.08:
                return 8, "Inflation pressure is buffered by explicit inflation-defense exposure."
            if inflation_defense >= 0.04:
                return 4, "Inflation pressure is only partially buffered."
            return 0, "Inflation pressure is adverse and inflation-defense exposure is minimal."
        if state == "supportive":
            return (8, "Cooling inflation supports the current mix.") if duration <= 0.35 else (4, "Cooling inflation helps, but duration remains meaningful.")
        return (8, "Inflation is neutral and portfolio carries acceptable hedging.") if inflation_defense >= 0.05 or duration <= 0.30 else (4, "Inflation is neutral, but hedging is limited.")

    if bucket == "Growth/Labor":
        if state == "supportive":
            return (8, "Growth backdrop supports current beta exposure.") if risk_beta >= 0.25 else (4, "Growth backdrop is supportive, but portfolio remains cautious.")
        if state == "adverse":
            if risk_beta <= 0.45 and diversifier_reserve >= 0.15:
                return 8, "Weak growth backdrop is matched by contained beta and some ballast."
            if risk_beta <= 0.60:
                return 4, "Weak growth backdrop is only partially reflected in the portfolio mix."
            return 0, "Weak growth backdrop conflicts with elevated beta exposure."
        return (8, "Growth backdrop is neutral and risk posture is balanced.") if 0.20 <= risk_beta <= 0.55 else (4, "Growth backdrop is neutral, but risk posture is lopsided.")

    if state == "adverse":
        if diversifier_reserve >= 0.20 and risk_beta <= 0.55:
            return 8, "Stress backdrop is adverse, but the portfolio still carries ballast."
        if diversifier_reserve >= 0.10:
            return 4, "Stress backdrop is adverse and ballast is only partial."
        return 0, "Stress backdrop is adverse while portfolio ballast remains limited."
    if state == "supportive":
        return (8, "Calmer stress backdrop allows risk assets to remain engaged.") if risk_beta >= 0.20 else (4, "Stress backdrop is supportive, but the portfolio remains unusually defensive.")
    return (8, "Stress backdrop is neutral and posture is balanced.") if diversifier_reserve >= 0.10 else (4, "Stress backdrop is neutral, but ballast is limited.")


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
            "max": 8,
            "state": _bucket_label(score, 8),
            "explanation": explanation,
        })
        total += score
        if score >= 8:
            positives.append(explanation)
        elif score <= 0:
            negatives.append(explanation)

    return {
        "score": total,
        "max": 40,
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

    if worst_return >= -15 and worst_mdd >= -20:
        stress_score = 10
    elif worst_return >= -25 and worst_mdd >= -35:
        stress_score = 6
    else:
        stress_score = 2

    if top1 <= 0.25 and top2 <= 0.45 and hhi <= 0.18:
        concentration_score = 10
    elif top1 <= 0.35 and top2 <= 0.60:
        concentration_score = 6
    else:
        concentration_score = 2

    reserve_diversifier = exposures["reserve"] + exposures["diversifier"]
    if reserve_diversifier >= 0.15:
        diversifier_score = 5
    elif reserve_diversifier >= 0.05:
        diversifier_score = 3
    else:
        diversifier_score = 0

    return {
        "score": stress_score + concentration_score + diversifier_score,
        "max": 25,
        "stressResilience": {
            "score": stress_score,
            "max": 10,
            "worstReturn": worst_return,
            "worstMdd": worst_mdd,
            "scenarios": stress_results,
        },
        "concentrationControl": {
            "score": concentration_score,
            "max": 10,
            "top1Weight": round(top1, 4),
            "top2Weight": round(top2, 4),
            "hhi": round(hhi, 4),
        },
        "diversifierReserve": {
            "score": diversifier_score,
            "max": 5,
            "weight": round(reserve_diversifier, 4),
        },
    }


def build_target_deviation(allocation: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return compute_alignment_score(allocation)["categories"]
