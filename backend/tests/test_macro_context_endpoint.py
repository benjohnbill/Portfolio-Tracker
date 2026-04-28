from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app


def test_macro_context_endpoint_envelope():
    with patch("app.services.macro_context_service.MacroContextService.get_macro_context") as mock_ctx:
        mock_ctx.return_value = {
            "indicators": [],
            "causalMap": {"bucketRules": [], "currentBucketStates": [], "sleeveImpacts": []},
            "positioning": {"sleeves": [], "bands": []},
            "performance": {"fit": None, "alignment": None, "posture": None, "trends": [], "avgTotalLast4Weeks": None, "lastTotal": None},
            "logicVersion": {"rules": "1.0.0", "meta": "1.0.0"},
            "knownAsOf": "2026-04-27",
        }
        client = TestClient(app)
        response = client.get("/api/intelligence/macro-context")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "data" in body
    assert body["data"]["logicVersion"] == {"rules": "1.0.0", "meta": "1.0.0"}


def test_macro_context_endpoint_returns_empty_envelope_on_upstream_error():
    with patch("app.services.macro_context_service.MacroContextService.get_macro_context", side_effect=RuntimeError("FRED down")):
        client = TestClient(app)
        response = client.get("/api/intelligence/macro-context")
    assert response.status_code == 200
    body = response.json()
    # Empty-state envelope must have status=ok with empty arrays per spec §4.5
    assert body["status"] == "ok"
    assert body["data"]["indicators"] == []
    assert body["data"]["knownAsOf"] is None
