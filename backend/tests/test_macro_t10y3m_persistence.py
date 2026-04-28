import pandas as pd
from app.services.macro_service import MacroService


def test_t10y3m_inversion_under_4_weeks_is_neutral():
    """3-week inversion does NOT yet trigger adverse — policy threshold is 4 weeks."""
    series = pd.Series([0.5] * 10 + [-0.1, -0.1, -0.1])  # only 3 inverted weeks
    state = MacroService._t10y3m_state(series)
    assert state in {"neutral", "supportive"}


def test_t10y3m_inversion_4_weeks_is_adverse():
    series = pd.Series([0.5] * 10 + [-0.1, -0.1, -0.1, -0.1])  # 4 inverted weeks
    state = MacroService._t10y3m_state(series)
    assert state == "adverse"


def test_t10y3m_positive_is_supportive():
    series = pd.Series([1.0] * 8)
    state = MacroService._t10y3m_state(series)
    assert state == "supportive"


def test_t10y3m_empty_is_neutral():
    state = MacroService._t10y3m_state(pd.Series(dtype=float))
    assert state == "neutral"
