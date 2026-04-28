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


FIT_RULES: list[FitRuleSpec] = [
    # ----- Liquidity/FCI -------------------------------------------------
    FitRuleSpec(
        bucket="Liquidity/FCI", state="supportive",
        predicates_full=[ThresholdPredicate("risk_beta", "between", (0.20, 0.70))],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Liquidity supports maintaining core risk exposure.",
        narrative_partial="Liquidity is supportive, but current risk stance is either too defensive or too aggressive.",
        narrative_miss="Liquidity is supportive, but current risk stance is either too defensive or too aggressive.",
    ),
    FitRuleSpec(
        bucket="Liquidity/FCI", state="neutral",
        predicates_full=[ThresholdPredicate("risk_beta", "between", (0.15, 0.60))],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Liquidity is neutral and portfolio stance is balanced.",
        narrative_partial="Liquidity is neutral, but stance leans away from balance.",
        narrative_miss="Liquidity is neutral, but stance leans away from balance.",
    ),
    FitRuleSpec(
        bucket="Liquidity/FCI", state="adverse",
        predicates_full=[ThresholdPredicate("diversifier_reserve", ">=", 0.20)],
        predicates_partial=[ThresholdPredicate("diversifier_reserve", ">=", 0.10)],
        points_full_match=6, points_partial_match=3, points_miss=0,
        narrative_full="Liquidity is tight, but reserve/diversifier sleeves are meaningful.",
        narrative_partial="Liquidity is tight and reserve coverage is only partial.",
        narrative_miss="Liquidity is adverse while reserve/diversifier sleeves are thin.",
    ),
    # ----- Rates ---------------------------------------------------------
    FitRuleSpec(
        bucket="Rates", state="supportive",
        predicates_full=[ThresholdPredicate("duration", ">=", 0.10)],
        predicates_partial=[ThresholdPredicate("risk_beta", ">=", 0.25)],
        points_full_match=6, points_partial_match=6, points_miss=3,
        narrative_full="Supportive rates backdrop allows duration and growth exposure.",
        narrative_partial="Supportive rates backdrop allows duration and growth exposure.",
        narrative_miss="Supportive rates backdrop is not fully utilized.",
    ),
    FitRuleSpec(
        bucket="Rates", state="neutral",
        predicates_full=[ThresholdPredicate("duration", "<=", 0.35)],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Rates backdrop is neutral and posture is balanced.",
        narrative_partial="Rates backdrop is neutral, but duration is elevated.",
        narrative_miss="Rates backdrop is neutral, but duration is elevated.",
    ),
    FitRuleSpec(
        bucket="Rates", state="adverse",
        predicates_full=[
            ThresholdPredicate("duration", "<=", 0.20),
            ThresholdPredicate("risk_beta", "<=", 0.60),
        ],
        predicates_partial=[ThresholdPredicate("duration", "<=", 0.30)],
        points_full_match=6, points_partial_match=3, points_miss=0,
        narrative_full="Adverse rates backdrop is matched by contained duration and beta exposure.",
        narrative_partial="Adverse rates backdrop is only partially matched by current duration posture.",
        narrative_miss="Rates backdrop is adverse while duration exposure remains elevated.",
    ),
    # ----- Inflation -----------------------------------------------------
    FitRuleSpec(
        bucket="Inflation", state="supportive",
        predicates_full=[ThresholdPredicate("duration", "<=", 0.35)],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Cooling inflation supports the current mix.",
        narrative_partial="Cooling inflation helps, but duration remains meaningful.",
        narrative_miss="Cooling inflation helps, but duration remains meaningful.",
    ),
    FitRuleSpec(
        bucket="Inflation", state="neutral",
        predicates_full=[ThresholdPredicate("inflation_defense", ">=", 0.05)],
        predicates_partial=[ThresholdPredicate("duration", "<=", 0.30)],
        points_full_match=6, points_partial_match=6, points_miss=3,
        narrative_full="Inflation is neutral and portfolio carries acceptable hedging.",
        narrative_partial="Inflation is neutral and portfolio carries acceptable hedging.",
        narrative_miss="Inflation is neutral, but hedging is limited.",
    ),
    FitRuleSpec(
        bucket="Inflation", state="adverse",
        predicates_full=[ThresholdPredicate("inflation_defense", ">=", 0.08)],
        predicates_partial=[ThresholdPredicate("inflation_defense", ">=", 0.04)],
        points_full_match=6, points_partial_match=3, points_miss=0,
        narrative_full="Inflation pressure is buffered by explicit inflation-defense exposure.",
        narrative_partial="Inflation pressure is only partially buffered.",
        narrative_miss="Inflation pressure is adverse and inflation-defense exposure is minimal.",
    ),
    # ----- Growth/Labor --------------------------------------------------
    FitRuleSpec(
        bucket="Growth/Labor", state="supportive",
        predicates_full=[ThresholdPredicate("risk_beta", ">=", 0.25)],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Growth backdrop supports current beta exposure.",
        narrative_partial="Growth backdrop is supportive, but portfolio remains cautious.",
        narrative_miss="Growth backdrop is supportive, but portfolio remains cautious.",
    ),
    FitRuleSpec(
        bucket="Growth/Labor", state="neutral",
        predicates_full=[ThresholdPredicate("risk_beta", "between", (0.20, 0.55))],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Growth backdrop is neutral and risk posture is balanced.",
        narrative_partial="Growth backdrop is neutral, but risk posture is lopsided.",
        narrative_miss="Growth backdrop is neutral, but risk posture is lopsided.",
    ),
    FitRuleSpec(
        bucket="Growth/Labor", state="adverse",
        predicates_full=[
            ThresholdPredicate("risk_beta", "<=", 0.45),
            ThresholdPredicate("diversifier_reserve", ">=", 0.15),
        ],
        predicates_partial=[ThresholdPredicate("risk_beta", "<=", 0.60)],
        points_full_match=6, points_partial_match=3, points_miss=0,
        narrative_full="Weak growth backdrop is matched by contained beta and some ballast.",
        narrative_partial="Weak growth backdrop is only partially reflected in the portfolio mix.",
        narrative_miss="Weak growth backdrop conflicts with elevated beta exposure.",
    ),
    # ----- Stress/Sentiment ---------------------------------------------
    FitRuleSpec(
        bucket="Stress/Sentiment", state="supportive",
        predicates_full=[ThresholdPredicate("risk_beta", ">=", 0.20)],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Calmer stress backdrop allows risk assets to remain engaged.",
        narrative_partial="Stress backdrop is supportive, but the portfolio remains unusually defensive.",
        narrative_miss="Stress backdrop is supportive, but the portfolio remains unusually defensive.",
    ),
    FitRuleSpec(
        bucket="Stress/Sentiment", state="neutral",
        predicates_full=[ThresholdPredicate("diversifier_reserve", ">=", 0.10)],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Stress backdrop is neutral and posture is balanced.",
        narrative_partial="Stress backdrop is neutral, but ballast is limited.",
        narrative_miss="Stress backdrop is neutral, but ballast is limited.",
    ),
    FitRuleSpec(
        bucket="Stress/Sentiment", state="adverse",
        predicates_full=[
            ThresholdPredicate("diversifier_reserve", ">=", 0.20),
            ThresholdPredicate("risk_beta", "<=", 0.55),
        ],
        predicates_partial=[ThresholdPredicate("diversifier_reserve", ">=", 0.10)],
        points_full_match=6, points_partial_match=3, points_miss=0,
        narrative_full="Stress backdrop is adverse, but the portfolio still carries ballast.",
        narrative_partial="Stress backdrop is adverse and ballast is only partial.",
        narrative_miss="Stress backdrop is adverse while portfolio ballast remains limited.",
    ),
]

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
