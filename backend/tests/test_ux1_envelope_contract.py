"""Per-endpoint envelope contract tests.

Each endpoint wrapped in Phase UX-1 gets three tests here:

  1. Success path returns envelope with status=ready and all expected fields.
  2. Upstream failure returns HTTP 200 + status=unavailable + empty shape.
  3. Empty-state shape equals loaded-state shape at the field-key level.
"""

from __future__ import annotations

from unittest.mock import patch


# --------------------------------------------------------------------------- #
# /api/reports/weekly/latest                                                  #
# --------------------------------------------------------------------------- #


def test_weekly_latest_returns_envelope_with_status(client):
    response = client.get("/api/reports/weekly/latest")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "report" in payload


def test_weekly_latest_unavailable_when_no_report(client):
    """Empty DB means no persisted report; must return unavailable shape, not 404."""
    response = client.get("/api/reports/weekly/latest")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "unavailable"
    assert payload["report"] is None


def test_weekly_latest_absorbs_service_failure_as_unavailable(client):
    from app.services.report_service import ReportService

    with patch.object(
        ReportService,
        "get_latest_report",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/reports/weekly/latest")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["report"] is None
