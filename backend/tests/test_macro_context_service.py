from unittest.mock import patch

from app.services.macro_context_service import MacroContextService


@patch("app.services.macro_context_service.MacroService.get_macro_snapshot_cached")
@patch("app.services.macro_context_service.PortfolioService.get_portfolio_allocation")
@patch("app.services.macro_context_service.IntelligenceService.get_attribution_history")
def test_macro_context_envelope_shape(mock_history, mock_alloc, mock_snap, db_session):
    mock_snap.return_value = {
        "overallState": "supportive",
        "buckets": [{"bucket": b, "state": "neutral"} for b in ["Liquidity/FCI", "Rates", "Inflation", "Growth/Labor", "Stress/Sentiment"]],
        "indicators": [{"key": "cpi_yoy", "bucket": "Inflation", "label": "CPI YoY", "value": 2.4, "unit": "%", "state": "supportive", "trend": "down"}],
        "knownAsOf": "2026-04-27",
    }
    mock_alloc.return_value = [{"asset": "NDX_1X", "weight": 0.30}, {"asset": "DBMF", "weight": 0.30}, {"asset": "BRAZIL", "weight": 0.10}, {"asset": "MSTR", "weight": 0.10}, {"asset": "GLDM", "weight": 0.10}, {"asset": "BIL", "weight": 0.10}]
    mock_history.return_value = [{"weekEnding": "2026-01-02", "totalScore": 65, "fitScore": 20, "alignmentScore": 22, "postureScore": 23}]

    result = MacroContextService.get_macro_context(db_session)

    assert {"indicators", "causalMap", "positioning", "performance", "logicVersion", "knownAsOf"} <= set(result.keys())
    assert result["logicVersion"]["rules"] == "1.0.0"
    assert result["logicVersion"]["meta"] == "1.0.0"
    assert result["knownAsOf"] == "2026-04-27"
    # indicators must each carry meta-attached fields
    for ind in result["indicators"]:
        assert "definition" in ind
        assert "leadLagTier" in ind
    # causalMap fields
    assert {"bucketRules", "currentBucketStates", "sleeveImpacts"} <= set(result["causalMap"].keys())
    # positioning has 6 sleeves
    assert len(result["positioning"]["sleeves"]) == 6
    # performance shape
    assert {"fit", "alignment", "posture", "trends"} <= set(result["performance"].keys())
