from unittest.mock import patch
from datetime import date
from app.services.macro_service import MacroService


def test_get_macro_vitals_uses_cache_on_second_call(db_session):
    snapshot = {
        "overallState": "neutral",
        "buckets": [],
        "indicators": [
            {"key": "net_liquidity", "value": 1.0, "unit": "T", "trend": "flat", "state": "supportive"},
            {"key": "real_yield_10y", "value": 2.0, "unit": "%", "trend": "down", "state": "supportive"},
        ],
        "knownAsOf": date.today().isoformat(),
    }

    with patch.object(MacroService, "get_macro_snapshot", return_value=snapshot) as mock_snapshot:
        first = MacroService.get_macro_vitals(db_session)
        second = MacroService.get_macro_vitals(db_session)

    assert first["net_liquidity"]["value"] == 1.0
    assert second["net_liquidity"]["value"] == 1.0
    # Cache must short-circuit upstream fetch on the second call.
    assert mock_snapshot.call_count == 1
