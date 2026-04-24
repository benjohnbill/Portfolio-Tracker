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


# --------------------------------------------------------------------------- #
# /api/v1/friday/briefing                                                     #
# --------------------------------------------------------------------------- #


def test_friday_briefing_returns_envelope(client):
    response = client.get("/api/v1/friday/briefing")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "sinceDate" in payload
    assert "regimeTransitions" in payload
    assert "maturedOutcomes" in payload
    assert "alertHistory" in payload
    assert "lastSnapshotComment" in payload


def test_friday_briefing_absorbs_service_failure(client):
    from app.services import briefing_service

    with patch.object(
        briefing_service.BriefingService,
        "get_briefing",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/friday/briefing")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["sinceDate"] is None
        assert payload["regimeTransitions"] == []
        assert payload["maturedOutcomes"] == []


def test_friday_briefing_rejects_invalid_date(client):
    response = client.get("/api/v1/friday/briefing?since=not-a-date")
    assert response.status_code == 400  # input validation still 4xx


def test_friday_briefing_returns_ready_envelope_when_service_returns_data(client):
    from app.services.briefing_service import BriefingService

    fake_briefing = {
        "sinceDate": "2026-04-11",
        "regimeTransitions": [{"bucket": "liquidity", "from": "neutral", "to": "adverse"}],
        "maturedOutcomes": [],
        "alertHistory": {"success": 3, "failed": 0, "lastFailureAt": None, "lastFailureMessage": None},
        "lastSnapshotComment": None,
    }
    with patch.object(BriefingService, "get_briefing", return_value=fake_briefing):
        response = client.get("/api/v1/friday/briefing")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["sinceDate"] == "2026-04-11"
        assert len(payload["regimeTransitions"]) == 1
        assert payload["regimeTransitions"][0]["bucket"] == "liquidity"


# --------------------------------------------------------------------------- #
# /api/v1/friday/sleeve-history                                               #
# --------------------------------------------------------------------------- #


def test_friday_sleeve_history_returns_envelope(client):
    response = client.get("/api/v1/friday/sleeve-history?weeks=4")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "sleeves" in payload


def test_friday_sleeve_history_absorbs_service_failure(client):
    from app.services import briefing_service

    with patch.object(
        briefing_service.BriefingService,
        "get_sleeve_history",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/friday/sleeve-history")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["sleeves"] == {}


def test_friday_sleeve_history_rejects_out_of_range_weeks(client):
    """ValueError from service still surfaces as 400 (input validation)."""
    response = client.get("/api/v1/friday/sleeve-history?weeks=0")
    assert response.status_code == 400


def test_friday_sleeve_history_returns_ready_envelope_when_service_returns_data(client):
    from app.services.briefing_service import BriefingService

    fake_history = {
        "NDX": [0, 1, 0, 2],
        "DBMF": [0, 0, 0, 0],
        "BRAZIL": [0, 0, 0, 0],
        "MSTR": [0, 0, 1, 0],
        "GLDM": [0, 0, 0, 0],
        "BONDS-CASH": [0, 0, 0, 0],
    }
    with patch.object(BriefingService, "get_sleeve_history", return_value=fake_history):
        response = client.get("/api/v1/friday/sleeve-history?weeks=4")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["sleeves"]["NDX"] == [0, 1, 0, 2]
        assert payload["sleeves"]["MSTR"] == [0, 0, 1, 0]


# --------------------------------------------------------------------------- #
# /api/v1/friday/current                                                      #
# --------------------------------------------------------------------------- #


def test_friday_current_returns_envelope(client):
    response = client.get("/api/v1/friday/current")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "report" in payload


def test_friday_current_absorbs_service_failure(client):
    from app.services.friday_service import FridayService

    with patch.object(
        FridayService,
        "get_current_report",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/friday/current")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["report"] is None


def test_friday_current_returns_ready_envelope_when_report_exists(client):
    from app.services.friday_service import FridayService

    fake_report = {
        "weekEnding": "2026-04-18",
        "score": {"total": 72},
        "portfolioSnapshot": {},
        "macroSnapshot": {},
    }
    with patch.object(FridayService, "get_current_report", return_value=fake_report):
        response = client.get("/api/v1/friday/current")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["report"]["weekEnding"] == "2026-04-18"
        assert payload["report"]["score"]["total"] == 72


# --------------------------------------------------------------------------- #
# /api/v1/friday/snapshots                                                    #
# --------------------------------------------------------------------------- #


def test_friday_snapshots_returns_envelope(client):
    response = client.get("/api/v1/friday/snapshots")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "snapshots" in payload
    assert "count" in payload


def test_friday_snapshots_absorbs_service_failure(client):
    from app.services.friday_service import FridayService

    with patch.object(
        FridayService,
        "list_snapshots",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/friday/snapshots")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["snapshots"] == []
        assert payload["count"] == 0


def test_friday_snapshots_returns_ready_envelope_when_snapshots_exist(client):
    from app.services.friday_service import FridayService

    fake_snapshots = [
        {
            "id": 1,
            "snapshotDate": "2026-04-11",
            "createdAt": "2026-04-11T12:00:00+00:00",
            "metadata": {},
            "comment": None,
            "decisions": [],
            "score": 70,
            "status": "final",
        }
    ]
    with patch.object(FridayService, "list_snapshots", return_value=fake_snapshots):
        response = client.get("/api/v1/friday/snapshots")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["count"] == 1
        assert payload["snapshots"][0]["snapshotDate"] == "2026-04-11"


# --------------------------------------------------------------------------- #
# /api/v1/friday/snapshot/{date}                                              #
# --------------------------------------------------------------------------- #


def test_friday_snapshot_envelope_on_missing_date(client):
    response = client.get("/api/v1/friday/snapshot/2020-01-03")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "unavailable"
    assert payload["snapshot"] is None


def test_friday_snapshot_envelope_shape(client):
    response = client.get("/api/v1/friday/snapshot/2020-01-03")
    payload = response.json()
    for key in {"status", "date", "coverage", "snapshot"}:
        assert key in payload
    for section in {"portfolio", "macro", "rules", "decisions", "slippage", "comment"}:
        assert section in payload["coverage"]


def test_friday_snapshot_rejects_bad_date(client):
    response = client.get("/api/v1/friday/snapshot/not-a-date")
    assert response.status_code == 400  # input validation stays 4xx


def test_friday_snapshot_absorbs_service_failure(client):
    from app.services.friday_service import FridayService

    with patch.object(
        FridayService,
        "get_snapshot",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/friday/snapshot/2026-04-18")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["snapshot"] is None
        assert payload["date"] == "2026-04-18"


def test_friday_snapshot_ready_envelope_when_fully_covered(client):
    """Fully-covered snapshot → status='ready' with all coverage flags True."""
    from app.services.friday_service import FridayService

    fake_snapshot = {
        "id": 11,
        "snapshotDate": "2026-04-18",
        "createdAt": "2026-04-18T12:00:00+00:00",
        "metadata": {},
        "comment": "Held the line.",
        "decisions": [
            {
                "id": 1,
                "snapshotId": 11,
                "decisionType": "hold",
                "note": "Stay.",
                "slippageEntries": [
                    {"id": 9, "decisionId": 1, "executedAt": "2026-04-18T13:00:00+00:00"}
                ],
            }
        ],
        "frozenReport": {
            "weekEnding": "2026-04-18",
            "portfolioSnapshot": {"totalValueKRW": 100_000_000},
            "macroSnapshot": {"overallState": "neutral"},
            "triggeredRules": [{"ruleId": "RULE_X", "severity": "info"}],
        },
    }
    with patch.object(FridayService, "get_snapshot", return_value=fake_snapshot):
        response = client.get("/api/v1/friday/snapshot/2026-04-18")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["date"] == "2026-04-18"
        assert payload["coverage"] == {
            "portfolio": True,
            "macro": True,
            "rules": True,
            "decisions": True,
            "slippage": True,
            "comment": True,
        }
        assert payload["snapshot"]["snapshotDate"] == "2026-04-18"


def test_friday_snapshot_partial_envelope_when_sections_missing(client):
    """Partial snapshot (missing rules/decisions/slippage) → status='partial'."""
    from app.services.friday_service import FridayService

    fake_snapshot = {
        "id": 12,
        "snapshotDate": "2026-04-18",
        "createdAt": "2026-04-18T12:00:00+00:00",
        "metadata": {},
        "comment": None,
        "decisions": [],
        "frozenReport": {
            "weekEnding": "2026-04-18",
            "portfolioSnapshot": {"totalValueKRW": 100_000_000},
            "macroSnapshot": {"overallState": "neutral"},
            "triggeredRules": [],
        },
    }
    with patch.object(FridayService, "get_snapshot", return_value=fake_snapshot):
        response = client.get("/api/v1/friday/snapshot/2026-04-18")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "partial"
        assert payload["coverage"]["portfolio"] is True
        assert payload["coverage"]["macro"] is True
        assert payload["coverage"]["rules"] is False
        assert payload["coverage"]["decisions"] is False
        assert payload["coverage"]["slippage"] is False
        assert payload["coverage"]["comment"] is False
        assert payload["snapshot"]["snapshotDate"] == "2026-04-18"
