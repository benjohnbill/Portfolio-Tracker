"""Core indicator must floor/ceiling the bucket score deterministically."""
from app.services.macro_service import MacroService


def test_growth_labor_capped_when_sahm_strong_adverse():
    indicators = [
        {"key": "real_gdp_growth", "bucket": "Growth/Labor", "state": "supportive"},
        {"key": "nfp_change_3m_avg", "bucket": "Growth/Labor", "state": "supportive"},
        {"key": "sahm_rule", "bucket": "Growth/Labor", "state": "adverse"},  # core
    ]
    summary = MacroService._aggregate_bucket("Growth/Labor", indicators)
    assert summary["state"] == "adverse", "Core indicator (Sahm) adverse must override majority"


def test_inflation_lifted_when_core_pce_supportive():
    indicators = [
        {"key": "cpi_yoy", "bucket": "Inflation", "state": "neutral"},
        {"key": "core_pce_yoy", "bucket": "Inflation", "state": "supportive"},  # core
    ]
    summary = MacroService._aggregate_bucket("Inflation", indicators)
    assert summary["state"] == "supportive"


def test_stress_sentiment_no_core_uses_majority():
    """Stress/Sentiment retains binary majority — no core_indicator entry."""
    indicators = [
        {"key": "vxn", "bucket": "Stress/Sentiment", "state": "adverse"},
        {"key": "credit_spread", "bucket": "Stress/Sentiment", "state": "adverse"},
    ]
    summary = MacroService._aggregate_bucket("Stress/Sentiment", indicators)
    assert summary["state"] == "adverse"


def test_neutral_core_falls_back_to_majority():
    """When core is neutral, majority among non-core indicators decides."""
    indicators = [
        {"key": "real_gdp_growth", "bucket": "Growth/Labor", "state": "supportive"},
        {"key": "nfp_change_3m_avg", "bucket": "Growth/Labor", "state": "supportive"},
        {"key": "sahm_rule", "bucket": "Growth/Labor", "state": "neutral"},  # core neutral
    ]
    summary = MacroService._aggregate_bucket("Growth/Labor", indicators)
    assert summary["state"] == "supportive"
