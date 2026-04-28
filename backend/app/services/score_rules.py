"""Externalized scoring predicate specs. Consumed by score_service._score_fit_bucket
(refactored to look up FIT_RULES) and by ScoreService.explain_fit (read-model
that returns the matched rule + projection). RULES_LOGIC_VERSION must bump on
any predicate threshold change."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Tuple, Union

RULES_LOGIC_VERSION = "1.0.0"

BUCKETS: tuple[str, ...] = ("Liquidity/FCI", "Rates", "Inflation", "Growth/Labor", "Stress/Sentiment")
STATES: tuple[str, ...] = ("supportive", "neutral", "adverse")

PredicateOp = Literal[">=", "<=", ">", "<", "between"]
PredicateValue = Union[float, Tuple[float, float]]


@dataclass(frozen=True)
class ThresholdPredicate:
    field: str
    op: PredicateOp
    value: PredicateValue


@dataclass(frozen=True)
class FitRuleSpec:
    bucket: str
    state: str
    predicates_full: list[ThresholdPredicate]      # AND — all must hold for full points
    predicates_partial: list[ThresholdPredicate]   # AND — all must hold for partial points
    points_full_match: int
    points_partial_match: int
    points_miss: int
    narrative_full: str
    narrative_partial: str
    narrative_miss: str


# Populated in P1-T4 — empty here so the structural test sees the variable.
FIT_RULES: list[FitRuleSpec] = []

# SLEEVE_FACTOR_MAP — sensitivity prior used by ScoreService._project_to_sleeves
# (Phase 3) to derive each sleeve's compatibility band ("below" / "in" / "above").
# Numbers are signed sensitivities, NOT weights. Sum across factors per sleeve is
# advisory, not normalized.
SLEEVE_FACTOR_MAP: dict[str, dict[str, int]] = {
    "NDX":        {"growth": +1, "liquidity": +1, "inflation": -1, "tight_fci": -1},
    "MSTR":       {"liquidity": +2, "growth": +1, "risk_off": -2},
    "DBMF":       {"dispersion": +1, "trend_persistence": +1, "equity_beta": 0},
    "GLDM":       {"real_rate": -1, "stress": +1},
    "BRAZIL":     {"dollar_liquidity": +1, "global_risk_on": +1, "rates": -1},
    "BONDS/CASH": {"growth_slowdown": +1, "inflation_reaccel": -1},
}
