"""Per-endpoint envelope contract tests.

Each endpoint wrapped in Phase UX-1 gets a bundle of tests here:

  1. Envelope shape check — every response carries `status` ∈ {ready,
     partial, unavailable} and a `report` key regardless of status.
  2. Empty-DB path returns status=unavailable with report=None (no 404).
  3. Upstream service failure is absorbed into status=unavailable, not a 500.
  4. Persisted-report path returns status=ready with the report payload
     surfaced under `report`.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
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


def test_weekly_latest_returns_ready_envelope_when_report_persisted(client, db_session):
    """Seeded WeeklyReport row → status=ready with report payload surfaced."""
    from app.models import WeeklyReport

    report_row = WeeklyReport(
        week_ending=date(2026, 4, 18),
        generated_at=datetime(2026, 4, 18, 12, 0, 0, tzinfo=timezone.utc),
        logic_version="weekly-report-v0",
        status="final",
        report_json={"score": {"total": 80}, "portfolioSnapshot": {}, "macroSnapshot": {}},
    )
    db_session.add(report_row)
    db_session.commit()

    response = client.get("/api/reports/weekly/latest")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["report"] is not None
    assert payload["report"]["score"]["total"] == 80
