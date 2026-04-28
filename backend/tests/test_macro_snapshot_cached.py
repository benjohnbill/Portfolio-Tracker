"""T2 cache: snapshot-with-meta-version key. Hit short-circuits the upstream
fetch."""

from unittest.mock import patch

from app.services.macro_service import MacroService
from app.data.macro_indicator_meta import META_LOGIC_VERSION
from app.services.cache_service import CacheService


def _today_key() -> str:
    from datetime import date
    return f"macro_snapshot:{date.today().isoformat()}_v{META_LOGIC_VERSION}"


def test_cached_snapshot_short_circuits_on_hit(db_session):
    payload = {"overallState": "neutral", "buckets": [], "indicators": [], "knownAsOf": "2026-04-27"}
    CacheService.set_cache(db_session, _today_key(), payload)
    with patch.object(MacroService, "get_macro_snapshot", side_effect=AssertionError("upstream should NOT be called")):
        result = MacroService.get_macro_snapshot_cached(db_session)
    assert result == payload


def test_cached_snapshot_writes_through_on_miss(db_session):
    CacheService.invalidate_cache(db_session, _today_key())
    fake_snapshot = {"overallState": "supportive", "buckets": [], "indicators": [], "knownAsOf": "2026-04-27"}
    with patch.object(MacroService, "get_macro_snapshot", return_value=fake_snapshot) as upstream:
        result = MacroService.get_macro_snapshot_cached(db_session)
        assert upstream.call_count == 1
    assert result == fake_snapshot
    assert CacheService.get_cache(db_session, _today_key()) == fake_snapshot
