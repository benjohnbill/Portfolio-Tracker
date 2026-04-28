"""Two veto branches must override stance to 'reduce_risk' regardless of total score."""

from app.services.report_service import ReportService


def _action_report(actions=None):
    return {"actions": actions or [], "signals": {}}


def test_posture_below_8_vetoes_to_reduce_risk():
    posture = {"score": 6, "stressResilience": {"score": 10}}
    rec = ReportService._build_recommendation(_action_report(), total_score=85, triggered_rules=[], posture=posture)
    assert rec["stance"] == "reduce_risk"


def test_stress_resilience_below_4_vetoes_to_reduce_risk():
    posture = {"score": 30, "stressResilience": {"score": 2}}
    rec = ReportService._build_recommendation(_action_report(), total_score=85, triggered_rules=[], posture=posture)
    assert rec["stance"] == "reduce_risk"


def test_no_veto_when_thresholds_clear():
    posture = {"score": 30, "stressResilience": {"score": 12}}
    rec = ReportService._build_recommendation(_action_report(), total_score=85, triggered_rules=[], posture=posture)
    assert rec["stance"] == "hold"


def test_veto_takes_precedence_over_action_signals():
    """Veto must fire above the existing 'rebalance if actions' branch."""
    posture = {"score": 6, "stressResilience": {"score": 10}}
    rec = ReportService._build_recommendation(
        _action_report(actions=[{"asset": "NDX", "action": "BUY", "reason": "signal"}]),
        total_score=70, triggered_rules=[], posture=posture,
    )
    assert rec["stance"] == "reduce_risk"


def test_low_total_still_reduce_risk_when_no_veto():
    """Existing total<45 reduce_risk path still works when veto does not fire."""
    posture = {"score": 30, "stressResilience": {"score": 12}}
    rec = ReportService._build_recommendation(_action_report(), total_score=40, triggered_rules=[], posture=posture)
    assert rec["stance"] == "reduce_risk"
