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

from datetime import date, datetime, timedelta, timezone
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


def test_friday_snapshot_partial_envelope_when_required_section_missing(client):
    """Partial snapshot when a required section (macro) is missing → status='partial'.

    Only 'portfolio' and 'macro' are required for ready. Here macroSnapshot
    is falsy, so the envelope must degrade to partial regardless of the
    optional flags.
    """
    from app.services.friday_service import FridayService

    fake_snapshot = {
        "id": 12,
        "snapshotDate": "2026-04-18",
        "createdAt": "2026-04-18T12:00:00+00:00",
        "metadata": {},
        "comment": "Held the line.",
        "decisions": [
            {
                "id": 1,
                "snapshotId": 12,
                "decisionType": "hold",
                "note": "Stay.",
                "slippageEntries": [],
            }
        ],
        "frozenReport": {
            "weekEnding": "2026-04-18",
            "portfolioSnapshot": {"totalValueKRW": 100_000_000},
            "macroSnapshot": None,  # required section absent → partial
            "triggeredRules": [{"ruleId": "RULE_X"}],
        },
    }
    with patch.object(FridayService, "get_snapshot", return_value=fake_snapshot):
        response = client.get("/api/v1/friday/snapshot/2026-04-18")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "partial"
        assert payload["coverage"]["portfolio"] is True
        assert payload["coverage"]["macro"] is False
        assert payload["snapshot"]["snapshotDate"] == "2026-04-18"


def test_friday_snapshot_ready_envelope_with_empty_optional_sections(client):
    """A snapshot with portfolio + macro present but no triggered rules,
    no decisions, no slippage, and no comment is still 'ready'. The four
    optional sections' emptiness is a valid ready state, not a coverage failure."""
    from app.services.friday_service import FridayService

    minimal_ready = {
        "id": 13,
        "snapshotDate": "2026-01-09",
        "createdAt": "2026-01-09T12:00:00+00:00",
        "metadata": {},
        "comment": "",
        "decisions": [],
        "frozenReport": {
            "portfolioSnapshot": {"totalValueKRW": 10_000_000},
            "macroSnapshot": {"overallState": "Neutral"},
            "triggeredRules": [],  # valid empty
        },
    }
    with patch.object(FridayService, "get_snapshot", return_value=minimal_ready):
        response = client.get("/api/v1/friday/snapshot/2026-01-09")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["coverage"]["portfolio"] is True
        assert payload["coverage"]["macro"] is True
        assert payload["coverage"]["rules"] is True  # list present, even if empty
        assert payload["coverage"]["decisions"] is True  # list present
        assert payload["coverage"]["slippage"] is False  # no slippage entries
        assert payload["coverage"]["comment"] is False  # empty string


def test_friday_snapshot_ready_envelope_from_real_serializer(client, db_session):
    """Integration test: seed a real snapshot row, let the endpoint go through
    the actual _serialize_snapshot, and verify the envelope status agrees.
    This catches silent drift if _serialize_snapshot ever renames a field."""
    from app.models import WeeklySnapshot
    from datetime import date, datetime, timezone

    snapshot_date = date(2026, 1, 16)
    row = WeeklySnapshot(
        snapshot_date=snapshot_date,
        created_at=datetime(2026, 1, 16, 20, 0, 0, tzinfo=timezone.utc),
        frozen_report={
            "portfolioSnapshot": {"totalValueKRW": 15_000_000},
            "macroSnapshot": {"overallState": "Risk On"},
            "triggeredRules": [],
            "score": {"total": 72},
            "weekEnding": "2026-01-16",
        },
        snapshot_metadata={
            "coverage": {
                "portfolio": True,
                "macro": True,
                "signals": True,
                "annotations": True,
                "score": True,
                "recommendation": True,
            }
        },
    )
    db_session.add(row)
    db_session.commit()

    response = client.get(f"/api/v1/friday/snapshot/{snapshot_date.isoformat()}")
    assert response.status_code == 200
    payload = response.json()
    # Serializer field names must produce a ready envelope for a
    # portfolio + macro present snapshot. If this fails after a refactor,
    # the serializer's field names drifted and compute_snapshot_coverage
    # needs updating.
    assert payload["status"] == "ready"
    assert payload["coverage"]["portfolio"] is True
    assert payload["coverage"]["macro"] is True


# --------------------------------------------------------------------------- #
# /api/v1/friday/compare                                                      #
# --------------------------------------------------------------------------- #


def test_friday_compare_envelope_shape_when_snapshots_missing(client):
    response = client.get("/api/v1/friday/compare?a=2020-01-01&b=2020-01-08")
    assert response.status_code == 200
    payload = response.json()
    for key in {"status", "a", "b", "comparison"}:
        assert key in payload
    assert payload["status"] == "unavailable"
    assert payload["comparison"] is None


def test_friday_compare_absorbs_service_failure(client):
    from app.services.friday_service import FridayService

    with patch.object(
        FridayService,
        "compare_snapshots",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/friday/compare?a=2020-01-01&b=2020-01-08")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["comparison"] is None


def test_friday_compare_rejects_bad_date(client):
    response = client.get("/api/v1/friday/compare?a=not-a-date&b=2020-01-08")
    assert response.status_code == 400


def test_friday_compare_ready_envelope_when_service_returns_comparison(client):
    from app.services.friday_service import FridayService

    fake_comparison = {
        "snapshotA": {
            "snapshotDate": "2020-01-01",
            "frozenReport": {"score": {"total": 70}},
        },
        "snapshotB": {
            "snapshotDate": "2020-01-08",
            "frozenReport": {"score": {"total": 75}},
        },
        "deltas": {
            "score_total": 5,
            "total_value": 0,
            "regime_change": {"from": "neutral", "to": "neutral"},
            "rules_added": [],
            "rules_removed": [],
            "holdings_changed": [],
        },
    }
    with patch.object(FridayService, "compare_snapshots", return_value=fake_comparison):
        response = client.get("/api/v1/friday/compare?a=2020-01-01&b=2020-01-08")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["a"] == "2020-01-01"
        assert payload["b"] == "2020-01-08"
        assert payload["comparison"] is not None
        assert payload["comparison"]["snapshotA"]["snapshotDate"] == "2020-01-01"
        assert payload["comparison"]["deltas"]["score_total"] == 5


# --------------------------------------------------------------------------- #
# D6 — SystemCache for /api/v1/friday/current                                 #
# --------------------------------------------------------------------------- #


def test_friday_current_cache_hits_on_second_call(client):
    """First call warms the cache; second call returns the cached payload
    without re-invoking get_current_report."""
    from app.services.friday_service import FridayService

    fake_report = {
        "weekEnding": "2026-04-18",
        "score": {"total": 72},
        "portfolioSnapshot": {},
        "macroSnapshot": {},
    }
    call_count = {"n": 0}

    def stub(db):
        call_count["n"] += 1
        return fake_report

    with patch.object(FridayService, "get_current_report", side_effect=stub):
        r1 = client.get("/api/v1/friday/current")
        r2 = client.get("/api/v1/friday/current")
        assert r1.status_code == r2.status_code == 200
        assert r1.json() == r2.json()
        assert r1.json()["status"] == "ready"
        # get_current_report called once (first request); second served from cache.
        assert call_count["n"] == 1


def test_friday_current_cache_invalidates_on_snapshot_create(db_session):
    """Creating a new snapshot invalidates the cached current-report so a
    subsequent GET re-hits get_current_report."""
    from app.services.cache_service import CacheService
    from app.services.friday_service import FridayService
    from app.services.report_service import ReportService

    # Prime the cache directly.
    CacheService.set_cache(
        db_session, FridayService.UX1_FRIDAY_CURRENT_KEY, {"stale": "payload"}
    )
    assert (
        CacheService.get_cache(db_session, FridayService.UX1_FRIDAY_CURRENT_KEY)
        is not None
    )

    minimal_report = {
        "weekEnding": "2026-04-18",
        "portfolioSnapshot": {},
        "macroSnapshot": {},
    }
    with patch.object(ReportService, "build_weekly_report", return_value=minimal_report):
        FridayService.create_snapshot(db_session)

    assert (
        CacheService.get_cache(db_session, FridayService.UX1_FRIDAY_CURRENT_KEY)
        is None
    )


def test_friday_current_cache_invalidates_on_transaction_create(client):
    """POST /api/transactions invalidates the cached current-report
    alongside the existing portfolio_* invalidation, so cashflow changes
    don't leave stale performance metrics in the cache.

    Verified via re-invocation counting: after priming the cache with a first
    GET, a subsequent GET-after-POST must re-invoke get_current_report
    (proving the cache was invalidated)."""
    from app.services.friday_service import FridayService

    fake_report = {
        "weekEnding": "2026-04-18",
        "score": {"total": 72},
        "portfolioSnapshot": {},
        "macroSnapshot": {},
    }
    call_count = {"n": 0}

    def stub(db):
        call_count["n"] += 1
        return fake_report

    with patch.object(FridayService, "get_current_report", side_effect=stub):
        # Warm cache
        r1 = client.get("/api/v1/friday/current")
        assert r1.status_code == 200
        assert call_count["n"] == 1

        # Second GET served from cache
        r2 = client.get("/api/v1/friday/current")
        assert r2.status_code == 200
        assert call_count["n"] == 1

        # Transaction write invalidates the cache
        response = client.post(
            "/api/transactions",
            json={
                "type": "DEPOSIT",
                "total_amount": 100000,
                "date": "2026-04-10",
                "account_type": "OVERSEAS",
            },
        )
        assert response.status_code == 200

        # Third GET re-invokes get_current_report — proving invalidation fired.
        r3 = client.get("/api/v1/friday/current")
        assert r3.status_code == 200
        assert call_count["n"] == 2


# --------------------------------------------------------------------------- #
# /api/intelligence/attributions                                              #
# --------------------------------------------------------------------------- #


def test_intelligence_attributions_returns_envelope(client):
    response = client.get("/api/intelligence/attributions")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "attributions" in payload


def test_intelligence_attributions_absorbs_service_failure(client):
    from app.services.intelligence_service import IntelligenceService

    with patch.object(
        IntelligenceService,
        "get_attributions",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/intelligence/attributions")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["attributions"] == []


def test_intelligence_attributions_returns_ready_when_data_exists(client):
    from app.services.intelligence_service import IntelligenceService

    fake_data = [
        {"snapshotDate": "2026-04-18", "buckets": [], "scoreTotal": 72},
    ]
    with patch.object(IntelligenceService, "get_attributions", return_value=fake_data):
        response = client.get("/api/intelligence/attributions")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["attributions"] == fake_data


# --------------------------------------------------------------------------- #
# /api/intelligence/rules/accuracy                                            #
# --------------------------------------------------------------------------- #


def test_intelligence_rules_accuracy_returns_envelope(client):
    response = client.get("/api/intelligence/rules/accuracy")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "rules" in payload


def test_intelligence_rules_accuracy_absorbs_service_failure(client):
    from app.services.intelligence_service import IntelligenceService

    with patch.object(
        IntelligenceService,
        "get_rule_accuracy",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/intelligence/rules/accuracy")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["rules"] == []


def test_intelligence_rules_accuracy_returns_ready_when_data_exists(client):
    from app.services.intelligence_service import IntelligenceService

    fake_rules = [
        {"ruleId": "R1", "fired": 5, "followed": 3, "accuracy": 0.6},
    ]
    with patch.object(IntelligenceService, "get_rule_accuracy", return_value=fake_rules):
        response = client.get("/api/intelligence/rules/accuracy")
        assert response.json()["status"] == "ready"
        assert response.json()["rules"] == fake_rules


# --------------------------------------------------------------------------- #
# /api/intelligence/outcomes                                                  #
# --------------------------------------------------------------------------- #


def test_intelligence_outcomes_returns_envelope(client):
    response = client.get("/api/intelligence/outcomes")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "outcomes" in payload
    assert "horizon" in payload


def test_intelligence_outcomes_absorbs_service_failure(client):
    from app.services.intelligence_service import IntelligenceService

    with patch.object(
        IntelligenceService,
        "get_outcomes",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/intelligence/outcomes")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["outcomes"] == []


def test_intelligence_outcomes_returns_ready_when_data_exists(client):
    from app.services.intelligence_service import IntelligenceService

    fake_outcomes = [
        {"decisionId": 1, "horizon": "3m", "outcomeDelta": 0.05},
    ]
    with patch.object(IntelligenceService, "get_outcomes", return_value=fake_outcomes):
        response = client.get("/api/intelligence/outcomes?horizon=3m")
        assert response.json()["status"] == "ready"
        assert response.json()["horizon"] == "3m"
        assert response.json()["outcomes"] == fake_outcomes


def test_intelligence_outcomes_rejects_bad_horizon(client):
    response = client.get("/api/intelligence/outcomes?horizon=not-a-horizon")
    assert response.status_code == 400


# --------------------------------------------------------------------------- #
# /api/intelligence/regime/history                                            #
# --------------------------------------------------------------------------- #


def test_intelligence_regime_history_returns_envelope(client):
    response = client.get("/api/intelligence/regime/history")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "transitions" in payload


def test_intelligence_regime_history_absorbs_service_failure(client):
    from app.services.intelligence_service import IntelligenceService

    with patch.object(
        IntelligenceService,
        "get_regime_history",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/intelligence/regime/history")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["transitions"] == []


def test_intelligence_regime_history_returns_ready_when_data_exists(client):
    from app.services.intelligence_service import IntelligenceService

    fake_transitions = [
        {"date": "2026-04-01", "from": "Risk On", "to": "Neutral"},
    ]
    with patch.object(IntelligenceService, "get_regime_history", return_value=fake_transitions):
        response = client.get("/api/intelligence/regime/history")
        assert response.json()["status"] == "ready"
        assert response.json()["transitions"] == fake_transitions


# --------------------------------------------------------------------------- #
# /api/intelligence/reviews/summary                                           #
# --------------------------------------------------------------------------- #


def test_intelligence_reviews_summary_returns_envelope(client):
    response = client.get("/api/intelligence/reviews/summary")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "summary" in payload


def test_intelligence_reviews_summary_absorbs_service_failure(client):
    from app.services.intelligence_service import IntelligenceService

    with patch.object(
        IntelligenceService,
        "get_review_summary",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/intelligence/reviews/summary")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["summary"] == {
            "totalWeeks": 0,
            "months": [],
            "quarters": [],
            "years": [],
        }


def test_intelligence_reviews_summary_returns_ready_when_data_exists(client):
    from app.services.intelligence_service import IntelligenceService

    fake_summary = {
        "totalWeeks": 24,
        "months": ["2026-04"],
        "quarters": ["2026-Q1"],
        "years": ["2026"],
    }
    with patch.object(IntelligenceService, "get_review_summary", return_value=fake_summary):
        response = client.get("/api/intelligence/reviews/summary")
        assert response.json()["status"] == "ready"
        assert response.json()["summary"] == fake_summary


# --------------------------------------------------------------------------- #
# /api/v1/intelligence/risk-adjusted/scorecard                                #
# --------------------------------------------------------------------------- #


def test_risk_adjusted_scorecard_returns_envelope(client):
    response = client.get("/api/v1/intelligence/risk-adjusted/scorecard")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "based_on_freezes" in payload
    assert "horizons" in payload
    assert "maturity_gate" in payload


def test_risk_adjusted_scorecard_absorbs_service_failure(client):
    from app.services.risk_adjusted_service import RiskAdjustedService

    with patch.object(
        RiskAdjustedService,
        "scorecard",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/intelligence/risk-adjusted/scorecard")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["based_on_freezes"] == 0


def test_risk_adjusted_scorecard_returns_ready_when_gate_passed(client):
    from app.services.risk_adjusted_service import RiskAdjustedService

    fake_scorecard = {
        "ready": True,
        "based_on_freezes": 26,
        "based_on_weeks": 26,
        "first_freeze_date": "2025-10-31",
        "maturity_gate": {"required_weeks": 26, "current_weeks": 26, "ready": True},
        "horizons": {"6M": {}, "1Y": {}, "ITD": {}},
    }
    with patch.object(RiskAdjustedService, "scorecard", return_value=fake_scorecard):
        response = client.get("/api/v1/intelligence/risk-adjusted/scorecard")
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["based_on_freezes"] == 26


def test_risk_adjusted_scorecard_unavailable_when_gate_not_passed(client):
    from app.services.risk_adjusted_service import RiskAdjustedService

    fake_scorecard = {
        "ready": False,
        "based_on_freezes": 10,
        "based_on_weeks": 10,
        "first_freeze_date": "2026-02-21",
        "maturity_gate": {"required_weeks": 26, "current_weeks": 10, "ready": False},
        "horizons": {"6M": {}, "1Y": {}, "ITD": {}},
    }
    with patch.object(RiskAdjustedService, "scorecard", return_value=fake_scorecard):
        response = client.get("/api/v1/intelligence/risk-adjusted/scorecard")
        payload = response.json()
        # Envelope-level status derived from maturity gate.
        assert payload["status"] == "unavailable"
        assert payload["maturity_gate"]["current_weeks"] == 10


# --------------------------------------------------------------------------- #
# /api/v1/intelligence/risk-adjusted/calmar-trajectory                        #
# --------------------------------------------------------------------------- #


def test_calmar_trajectory_returns_envelope(client):
    response = client.get("/api/v1/intelligence/risk-adjusted/calmar-trajectory")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "points" in payload


def test_calmar_trajectory_absorbs_service_failure(client):
    from app.services.risk_adjusted_service import RiskAdjustedService

    with patch.object(
        RiskAdjustedService,
        "calmar_trajectory",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/intelligence/risk-adjusted/calmar-trajectory")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["points"] == []


# --------------------------------------------------------------------------- #
# /api/reports/weekly (list)                                                  #
# --------------------------------------------------------------------------- #


def test_weekly_list_returns_envelope(client):
    response = client.get("/api/reports/weekly")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "count" in payload
    assert "reports" in payload


def test_weekly_list_unavailable_when_no_rows(client):
    """Empty DB → status=unavailable with reports=[] (not 404, not raw [])."""
    response = client.get("/api/reports/weekly")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "unavailable"
    assert payload["reports"] == []
    assert payload["count"] == 0


def test_weekly_list_absorbs_service_failure_as_unavailable(client):
    from app.services.report_service import ReportService

    with patch.object(
        ReportService,
        "list_reports",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/reports/weekly")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["reports"] == []
        assert payload["count"] == 0


def test_weekly_list_returns_ready_envelope_when_rows_exist(client, db_session):
    from app.models import WeeklyReport

    db_session.add_all(
        [
            WeeklyReport(
                week_ending=date(2026, 4, 18),
                generated_at=datetime(2026, 4, 18, 12, 0, 0, tzinfo=timezone.utc),
                logic_version="weekly-report-v0",
                status="final",
                report_json={"score": {"total": 80}},
            ),
            WeeklyReport(
                week_ending=date(2026, 4, 11),
                generated_at=datetime(2026, 4, 11, 12, 0, 0, tzinfo=timezone.utc),
                logic_version="weekly-report-v0",
                status="final",
                report_json={"score": {"total": 72}},
            ),
        ]
    )
    db_session.commit()

    response = client.get("/api/reports/weekly")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["count"] == 2
    assert len(payload["reports"]) == 2
    # Ordered newest-first (matches ReportService.list_reports).
    assert payload["reports"][0]["weekEnding"] == "2026-04-18"
    assert payload["reports"][0]["score"] == 80


def test_weekly_list_respects_limit_query(client, db_session):
    from app.models import WeeklyReport

    for i in range(5):
        db_session.add(
            WeeklyReport(
                week_ending=date(2026, 3, 7) + timedelta(days=7 * i),
                generated_at=datetime(2026, 3, 7, 12, 0, 0, tzinfo=timezone.utc),
                logic_version="weekly-report-v0",
                status="final",
                report_json={"score": {"total": 70 + i}},
            )
        )
    db_session.commit()

    response = client.get("/api/reports/weekly?limit=3")
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["count"] == 3
    assert len(payload["reports"]) == 3


# --------------------------------------------------------------------------- #
# /api/reports/weekly/{week_ending} (detail)                                  #
# --------------------------------------------------------------------------- #


def test_weekly_detail_returns_envelope_shape(client, db_session):
    """Happy-path shape check: envelope root has status/week_ending/report."""
    from app.models import WeeklyReport

    db_session.add(
        WeeklyReport(
            week_ending=date(2026, 4, 18),
            generated_at=datetime(2026, 4, 18, 12, 0, 0, tzinfo=timezone.utc),
            logic_version="weekly-report-v0",
            status="final",
            report_json={"score": {"total": 80}},
        )
    )
    db_session.commit()

    response = client.get("/api/reports/weekly/2026-04-18")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert payload["week_ending"] == "2026-04-18"
    assert "report" in payload


def test_weekly_detail_unavailable_when_not_found(client):
    """Missing week_ending → status=unavailable with report=None, HTTP 200 (not 404)."""
    response = client.get("/api/reports/weekly/2026-04-18")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "unavailable"
    assert payload["week_ending"] == "2026-04-18"
    assert payload["report"] is None


def test_weekly_detail_rejects_bad_date(client):
    """Malformed week_ending stays 400 — input validation only."""
    response = client.get("/api/reports/weekly/not-a-date")
    assert response.status_code == 400


def test_weekly_detail_absorbs_service_failure_as_unavailable(client):
    from app.services.report_service import ReportService

    with patch.object(
        ReportService,
        "get_report_by_week",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/reports/weekly/2026-04-18")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["report"] is None
        assert payload["week_ending"] == "2026-04-18"


def test_weekly_detail_returns_ready_when_persisted(client, db_session):
    from app.models import WeeklyReport

    db_session.add(
        WeeklyReport(
            week_ending=date(2026, 4, 18),
            generated_at=datetime(2026, 4, 18, 12, 0, 0, tzinfo=timezone.utc),
            logic_version="weekly-report-v0",
            status="final",
            report_json={"score": {"total": 82}, "portfolioSnapshot": {}, "macroSnapshot": {}},
        )
    )
    db_session.commit()

    response = client.get("/api/reports/weekly/2026-04-18")
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["report"] is not None
    assert payload["report"]["score"]["total"] == 82


# --------------------------------------------------------------------------- #
# /api/portfolio/summary                                                      #
# --------------------------------------------------------------------------- #


def test_portfolio_summary_returns_envelope(client):
    response = client.get("/api/portfolio/summary")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "total_value" in payload
    assert "invested_capital" in payload
    assert "metrics" in payload


def test_portfolio_summary_absorbs_service_failure(client):
    from app.services.portfolio_service import PortfolioService

    with patch.object(
        PortfolioService,
        "get_portfolio_summary",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/portfolio/summary")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["total_value"] == 0
        assert payload["invested_capital"] == 0
        assert payload["metrics"] == {
            "total_return": 0,
            "cagr": 0,
            "mdd": 0,
            "volatility": 0,
            "sharpe_ratio": 0,
        }


def test_portfolio_summary_returns_ready_when_service_succeeds(client):
    from app.services.portfolio_service import PortfolioService

    fake_summary = {
        "total_value": 100_000_000,
        "invested_capital": 80_000_000,
        "metrics": {
            "total_return": 0.25,
            "cagr": 0.12,
            "mdd": -0.08,
            "volatility": 0.18,
            "sharpe_ratio": 0.67,
        },
    }
    with patch.object(PortfolioService, "get_portfolio_summary", return_value=fake_summary):
        response = client.get("/api/portfolio/summary")
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["total_value"] == 100_000_000
        assert payload["metrics"]["cagr"] == 0.12
