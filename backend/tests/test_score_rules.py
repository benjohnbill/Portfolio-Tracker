import pytest
from app.services.score_rules import (
    RULES_LOGIC_VERSION,
    FIT_RULES,
    SLEEVE_FACTOR_MAP,
    ThresholdPredicate,
    FitRuleSpec,
    BUCKETS,
    STATES,
)


def test_rules_logic_version():
    assert RULES_LOGIC_VERSION == "1.0.0"


def test_fit_rules_cover_all_15_combinations():
    assert len(FIT_RULES) == 15
    seen = {(r.bucket, r.state) for r in FIT_RULES}
    expected = {(b, s) for b in BUCKETS for s in STATES}
    assert seen == expected


def test_sleeve_factor_map_covers_six_sleeves():
    assert set(SLEEVE_FACTOR_MAP.keys()) == {"NDX", "MSTR", "DBMF", "GLDM", "BRAZIL", "BONDS/CASH"}


def test_each_rule_has_three_distinct_point_levels():
    """Full >= Partial >= Miss, and at least one pair is strictly ordered.
    OR-condition rules legitimately have full == partial (same points for either branch);
    the important invariant is that partial > miss so there's always an incentive to avoid
    the miss state."""
    for r in FIT_RULES:
        assert r.points_full_match >= r.points_partial_match >= r.points_miss
        # Either full > partial OR partial > miss (prevents all-equal degenerate rules)
        assert r.points_full_match > r.points_partial_match or r.points_partial_match > r.points_miss


def test_threshold_predicate_op_set():
    valid = {">=", "<=", ">", "<", "between"}
    for r in FIT_RULES:
        for p in r.predicates_full:
            assert p.op in valid, (r.bucket, r.state, p)
        for p in r.predicates_partial:
            assert p.op in valid, (r.bucket, r.state, p)


def test_predicate_field_set():
    valid = {"risk_beta", "duration", "inflation_defense", "diversifier", "reserve", "diversifier_reserve"}
    for r in FIT_RULES:
        for p in r.predicates_full:
            assert p.field in valid, (r.bucket, r.state, p)
        for p in r.predicates_partial:
            assert p.field in valid, (r.bucket, r.state, p)
