"""Pins _score_fit_bucket behavior across the 5 buckets × 3 states × representative
exposure profiles. Used to prove the FIT_RULES extraction (P1-T4) preserves
behavior.

NOTE on max points: in v1.x.x each bucket awards 0/4/8 (max 8). In v2.4 each bucket
awards 0/3/6 (max 6). This test pins v1.x.x behavior to be re-asserted after the
extraction; the v2.4 reweight is applied in P1-T5 by simply rescaling the
points_full_match / points_partial_match / points_miss fields on each rule.
"""

from __future__ import annotations

import pytest

from app.services.score_service import _score_fit_bucket


PROFILES: dict[str, dict[str, float]] = {
    "balanced":            {"risk_beta": 0.40, "duration": 0.15, "inflation_defense": 0.06, "diversifier": 0.20, "reserve": 0.05},
    "aggressive":          {"risk_beta": 0.80, "duration": 0.05, "inflation_defense": 0.00, "diversifier": 0.10, "reserve": 0.05},
    "defensive":           {"risk_beta": 0.10, "duration": 0.40, "inflation_defense": 0.10, "diversifier": 0.15, "reserve": 0.20},
    "no_inflation_hedge":  {"risk_beta": 0.50, "duration": 0.20, "inflation_defense": 0.02, "diversifier": 0.15, "reserve": 0.05},
    "rich_diversifier":    {"risk_beta": 0.30, "duration": 0.10, "inflation_defense": 0.05, "diversifier": 0.25, "reserve": 0.15},
}

BUCKETS = ["Liquidity", "Rates", "Inflation", "Growth/Labor", "Stress/Sentiment"]
STATES = ["supportive", "neutral", "adverse"]


EXPECTED: dict[tuple[str, str, str], int] = {
    ('Liquidity', 'supportive', 'balanced'): 8,
    ('Liquidity', 'supportive', 'aggressive'): 4,
    ('Liquidity', 'supportive', 'defensive'): 4,
    ('Liquidity', 'supportive', 'no_inflation_hedge'): 8,
    ('Liquidity', 'supportive', 'rich_diversifier'): 8,
    ('Liquidity', 'neutral', 'balanced'): 8,
    ('Liquidity', 'neutral', 'aggressive'): 4,
    ('Liquidity', 'neutral', 'defensive'): 4,
    ('Liquidity', 'neutral', 'no_inflation_hedge'): 8,
    ('Liquidity', 'neutral', 'rich_diversifier'): 8,
    ('Liquidity', 'adverse', 'balanced'): 8,
    ('Liquidity', 'adverse', 'aggressive'): 4,
    ('Liquidity', 'adverse', 'defensive'): 8,
    ('Liquidity', 'adverse', 'no_inflation_hedge'): 8,
    ('Liquidity', 'adverse', 'rich_diversifier'): 8,
    ('Rates', 'supportive', 'balanced'): 8,
    ('Rates', 'supportive', 'aggressive'): 8,
    ('Rates', 'supportive', 'defensive'): 8,
    ('Rates', 'supportive', 'no_inflation_hedge'): 8,
    ('Rates', 'supportive', 'rich_diversifier'): 8,
    ('Rates', 'neutral', 'balanced'): 8,
    ('Rates', 'neutral', 'aggressive'): 8,
    ('Rates', 'neutral', 'defensive'): 4,
    ('Rates', 'neutral', 'no_inflation_hedge'): 8,
    ('Rates', 'neutral', 'rich_diversifier'): 8,
    ('Rates', 'adverse', 'balanced'): 8,
    ('Rates', 'adverse', 'aggressive'): 4,
    ('Rates', 'adverse', 'defensive'): 0,
    ('Rates', 'adverse', 'no_inflation_hedge'): 8,
    ('Rates', 'adverse', 'rich_diversifier'): 8,
    ('Inflation', 'supportive', 'balanced'): 8,
    ('Inflation', 'supportive', 'aggressive'): 8,
    ('Inflation', 'supportive', 'defensive'): 4,
    ('Inflation', 'supportive', 'no_inflation_hedge'): 8,
    ('Inflation', 'supportive', 'rich_diversifier'): 8,
    ('Inflation', 'neutral', 'balanced'): 8,
    ('Inflation', 'neutral', 'aggressive'): 8,
    ('Inflation', 'neutral', 'defensive'): 8,
    ('Inflation', 'neutral', 'no_inflation_hedge'): 8,
    ('Inflation', 'neutral', 'rich_diversifier'): 8,
    ('Inflation', 'adverse', 'balanced'): 4,
    ('Inflation', 'adverse', 'aggressive'): 0,
    ('Inflation', 'adverse', 'defensive'): 8,
    ('Inflation', 'adverse', 'no_inflation_hedge'): 0,
    ('Inflation', 'adverse', 'rich_diversifier'): 4,
    ('Growth/Labor', 'supportive', 'balanced'): 8,
    ('Growth/Labor', 'supportive', 'aggressive'): 8,
    ('Growth/Labor', 'supportive', 'defensive'): 4,
    ('Growth/Labor', 'supportive', 'no_inflation_hedge'): 8,
    ('Growth/Labor', 'supportive', 'rich_diversifier'): 8,
    ('Growth/Labor', 'neutral', 'balanced'): 8,
    ('Growth/Labor', 'neutral', 'aggressive'): 4,
    ('Growth/Labor', 'neutral', 'defensive'): 4,
    ('Growth/Labor', 'neutral', 'no_inflation_hedge'): 8,
    ('Growth/Labor', 'neutral', 'rich_diversifier'): 8,
    ('Growth/Labor', 'adverse', 'balanced'): 8,
    ('Growth/Labor', 'adverse', 'aggressive'): 0,
    ('Growth/Labor', 'adverse', 'defensive'): 8,
    ('Growth/Labor', 'adverse', 'no_inflation_hedge'): 4,
    ('Growth/Labor', 'adverse', 'rich_diversifier'): 8,
    ('Stress/Sentiment', 'supportive', 'balanced'): 8,
    ('Stress/Sentiment', 'supportive', 'aggressive'): 8,
    ('Stress/Sentiment', 'supportive', 'defensive'): 4,
    ('Stress/Sentiment', 'supportive', 'no_inflation_hedge'): 8,
    ('Stress/Sentiment', 'supportive', 'rich_diversifier'): 8,
    ('Stress/Sentiment', 'neutral', 'balanced'): 8,
    ('Stress/Sentiment', 'neutral', 'aggressive'): 8,
    ('Stress/Sentiment', 'neutral', 'defensive'): 8,
    ('Stress/Sentiment', 'neutral', 'no_inflation_hedge'): 8,
    ('Stress/Sentiment', 'neutral', 'rich_diversifier'): 8,
    ('Stress/Sentiment', 'adverse', 'balanced'): 8,
    ('Stress/Sentiment', 'adverse', 'aggressive'): 4,
    ('Stress/Sentiment', 'adverse', 'defensive'): 8,
    ('Stress/Sentiment', 'adverse', 'no_inflation_hedge'): 8,
    ('Stress/Sentiment', 'adverse', 'rich_diversifier'): 8,
}


@pytest.mark.parametrize("bucket", BUCKETS)
@pytest.mark.parametrize("state", STATES)
@pytest.mark.parametrize("profile_name", list(PROFILES.keys()))
def test_score_fit_bucket_v1_behavior_pinned(bucket: str, state: str, profile_name: str):
    expected = EXPECTED.get((bucket, state, profile_name))
    if expected is None:
        pytest.skip(f"Expected value not yet recorded for ({bucket}, {state}, {profile_name})")
    actual, _ = _score_fit_bucket(bucket, state, PROFILES[profile_name])
    assert actual == expected, f"Behavior drift: ({bucket}, {state}, {profile_name}) → {actual}, expected {expected}"
