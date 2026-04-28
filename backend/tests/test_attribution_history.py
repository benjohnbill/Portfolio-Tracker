from app.services.intelligence_service import IntelligenceService


def test_get_attribution_history_returns_at_most_n_weeks(db_session):
    history = IntelligenceService.get_attribution_history(db_session, weeks=26)
    assert isinstance(history, list)
    assert len(history) <= 26
    if history:
        first = history[0]
        assert {"weekEnding", "totalScore", "fitScore", "alignmentScore", "postureScore"} <= set(first.keys())


def test_get_attribution_history_ordered_oldest_first(db_session):
    history = IntelligenceService.get_attribution_history(db_session, weeks=26)
    if len(history) >= 2:
        assert history[0]["weekEnding"] <= history[-1]["weekEnding"]
