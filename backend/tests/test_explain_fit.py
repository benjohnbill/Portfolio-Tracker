"""explain_fit returns structured causal trace + sleeve projection."""

from app.services.score_service import ScoreService


def _alloc(weights: dict[str, float]) -> list[dict]:
    return [{"asset": s, "weight": w} for s, w in weights.items()]


def _snapshot(buckets: list[tuple[str, str]]) -> dict:
    return {
        "overallState": "neutral",
        "buckets": [{"bucket": b, "state": s} for b, s in buckets],
        "indicators": [],
        "knownAsOf": "2026-04-27",
    }


def test_explain_fit_returns_total_and_per_bucket_traces():
    snapshot = _snapshot([
        ("Liquidity/FCI", "supportive"),
        ("Rates", "neutral"),
        ("Inflation", "neutral"),
        ("Growth/Labor", "supportive"),
        ("Stress/Sentiment", "neutral"),
    ])
    allocation = _alloc({"NDX_1X": 0.30, "DBMF": 0.30, "BRAZIL": 0.10, "MSTR": 0.10, "GLDM": 0.10, "BIL": 0.10})
    result = ScoreService.explain_fit(snapshot, allocation)
    assert "totalFit" in result
    assert 0 <= result["totalFit"] <= 30
    assert len(result["buckets"]) == 5
    for b in result["buckets"]:
        assert {"bucket", "state", "points", "narrative", "rule", "sleeveProjection"} <= set(b.keys())


def test_explain_fit_sleeve_projection_includes_compatibility_band():
    snapshot = _snapshot([
        ("Liquidity/FCI", "supportive"),
        ("Rates", "neutral"),
        ("Inflation", "neutral"),
        ("Growth/Labor", "supportive"),
        ("Stress/Sentiment", "neutral"),
    ])
    allocation = _alloc({"NDX_1X": 0.30, "DBMF": 0.30, "BRAZIL": 0.10, "MSTR": 0.10, "GLDM": 0.10, "BIL": 0.10})
    result = ScoreService.explain_fit(snapshot, allocation)
    bands = {s["sleeve"]: s["compatibilityBand"] for b in result["buckets"] for s in b["sleeveProjection"]}
    assert {"NDX", "MSTR", "DBMF", "GLDM", "BRAZIL", "BONDS/CASH"} <= set(bands.keys())
    for band in bands.values():
        assert band in {"below", "in", "above"}


def test_explain_fit_exposure_aggregates_in_result():
    snapshot = _snapshot([
        ("Liquidity/FCI", "supportive"),
        ("Rates", "neutral"),
        ("Inflation", "neutral"),
        ("Growth/Labor", "supportive"),
        ("Stress/Sentiment", "neutral"),
    ])
    allocation = _alloc({"NDX_1X": 0.50, "DBMF": 0.30, "BIL": 0.20})
    result = ScoreService.explain_fit(snapshot, allocation)
    aggs = result["exposureAggregates"]
    assert {"risk_beta", "duration", "inflation_defense", "diversifier", "reserve"} <= set(aggs.keys())
