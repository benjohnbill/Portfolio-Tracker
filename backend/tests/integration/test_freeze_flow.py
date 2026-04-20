"""Phase D Ship Now — freeze flow E2E (Plan C regression lock).

Three assertions that must hold forever:
1. POST snapshot + decision succeeds; response never contains a bare `confidence` key.
2. POST decision without `confidence_vs_spy_riskadj` → 422.
3. POST decision with legacy `confidence` key → body never echoes it.

Response shape (confirmed from friday_service._serialize_decision):
  camelCase keys: confidenceVsSpyRiskadj, confidenceVsCash, confidenceVsSpyPure
  no `confidence` key in snapshot or decision response.

Snapshot POST returns 200 (no explicit status_code set on the route).
create_snapshot calls build_weekly_report which tolerates an empty DB (returns
zero-value portfolio summary without raising), so no WeeklyReport seeding needed.
"""

from __future__ import annotations

from datetime import date

import pytest
from freezegun import freeze_time

TARGET_FRIDAY = date(2026, 4, 24)


@pytest.mark.integration
@freeze_time("2026-04-24 12:00:00")
def test_freeze_flow_plan_c_fields_present_legacy_absent(pg_client, pg_session):
    """Full freeze flow: snapshot + decision. No bare `confidence` key anywhere."""
    snap_resp = pg_client.post(
        "/api/v1/friday/snapshot",
        json={
            "snapshot_date": TARGET_FRIDAY.isoformat(),
            "comment": "QA freeze — Plan C regression lock",
        },
    )
    assert snap_resp.status_code == 200, snap_resp.text
    snap_body = snap_resp.json()
    assert snap_body.get("comment") == "QA freeze — Plan C regression lock"
    assert "confidence" not in snap_body
    snapshot_id = snap_body["id"]

    dec_resp = pg_client.post(
        "/api/v1/friday/decisions",
        json={
            "snapshot_id": snapshot_id,
            "decision_type": "hold",
            "asset_ticker": "QQQ",
            "note": "E2E test decision",
            "confidence_vs_spy_riskadj": 7,
            "confidence_vs_cash": 9,
            "confidence_vs_spy_pure": 5,
            "invalidation": "if SPY drops >5% in 2 weeks",
            "expected_failure_mode": "price_drop",
            "trigger_threshold": 0.05,
        },
    )
    assert dec_resp.status_code == 200, dec_resp.text
    dec_body = dec_resp.json()

    # Plan C fields present with camelCase keys
    assert dec_body.get("confidenceVsSpyRiskadj") == 7
    assert dec_body.get("confidenceVsCash") == 9
    assert dec_body.get("confidenceVsSpyPure") == 5

    # Legacy bare key must be absent
    assert "confidence" not in dec_body


@pytest.mark.integration
@freeze_time("2026-04-24 12:00:00")
def test_decision_requires_confidence_vs_spy_riskadj(pg_client, pg_session):
    """POST decision without required confidence_vs_spy_riskadj → 422."""
    snap_resp = pg_client.post(
        "/api/v1/friday/snapshot",
        json={"snapshot_date": TARGET_FRIDAY.isoformat()},
    )
    assert snap_resp.status_code == 200, snap_resp.text
    snapshot_id = snap_resp.json()["id"]

    dec_resp = pg_client.post(
        "/api/v1/friday/decisions",
        json={
            "snapshot_id": snapshot_id,
            "decision_type": "hold",
            "asset_ticker": "QQQ",
            "note": "missing required confidence_vs_spy_riskadj",
            # confidence_vs_spy_riskadj intentionally omitted
        },
    )
    assert dec_resp.status_code == 422, dec_resp.text


@pytest.mark.integration
@freeze_time("2026-04-24 12:00:00")
def test_decision_rejects_legacy_confidence_field(pg_client, pg_session):
    """Client sending legacy `confidence` key — must not appear in response body."""
    snap_resp = pg_client.post(
        "/api/v1/friday/snapshot",
        json={"snapshot_date": TARGET_FRIDAY.isoformat()},
    )
    assert snap_resp.status_code == 200, snap_resp.text
    snapshot_id = snap_resp.json()["id"]

    dec_resp = pg_client.post(
        "/api/v1/friday/decisions",
        json={
            "snapshot_id": snapshot_id,
            "decision_type": "hold",
            "asset_ticker": "QQQ",
            "note": "client sending legacy field",
            "confidence_vs_spy_riskadj": 6,
            "confidence": 6,  # legacy — Pydantic ignores unknown fields; must not echo
        },
    )
    # Request is valid (has the required field), so it should succeed
    assert dec_resp.status_code == 200, dec_resp.text
    body = dec_resp.json()
    assert "confidence" not in body
