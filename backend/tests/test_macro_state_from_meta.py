import pandas as pd
from app.services.macro_service import MacroService


def test_cpi_uses_meta_supportive_below_25():
    series = pd.Series([1.0, 1.5, 2.4])
    assert MacroService._state_from_meta("cpi_yoy", series) == "supportive"


def test_cpi_uses_meta_adverse_above_35():
    series = pd.Series([3.0, 3.4, 3.7])
    assert MacroService._state_from_meta("cpi_yoy", series) == "adverse"


def test_cpi_neutral_in_band():
    series = pd.Series([2.6, 2.9, 3.0])
    assert MacroService._state_from_meta("cpi_yoy", series) == "neutral"


def test_sahm_rule_thresholds():
    assert MacroService._state_from_meta("sahm_rule", pd.Series([0.20])) == "supportive"
    assert MacroService._state_from_meta("sahm_rule", pd.Series([0.40])) == "neutral"
    assert MacroService._state_from_meta("sahm_rule", pd.Series([0.55])) == "adverse"


def test_nfci_thresholds():
    assert MacroService._state_from_meta("nfci", pd.Series([-0.30])) == "supportive"
    assert MacroService._state_from_meta("nfci", pd.Series([0.0])) == "neutral"
    assert MacroService._state_from_meta("nfci", pd.Series([0.30])) == "adverse"


def test_empty_series_returns_neutral():
    assert MacroService._state_from_meta("cpi_yoy", pd.Series(dtype=float)) == "neutral"
