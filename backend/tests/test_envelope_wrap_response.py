"""Contract tests for wrap_response — the envelope helper used by every
read-path endpoint to guarantee a consistent response shape."""

import pytest

from app.api._envelope import wrap_response


def test_wrap_response_includes_status_key():
    result = wrap_response(status="ready", events=[])
    assert "status" in result
    assert result["status"] == "ready"


def test_wrap_response_passes_through_domain_fields():
    result = wrap_response(status="ready", events=["a", "b"], since="2026-04-20")
    assert result["events"] == ["a", "b"]
    assert result["since"] == "2026-04-20"


def test_wrap_response_preserves_empty_shape_on_unavailable():
    result = wrap_response(status="unavailable", events=[], since=None)
    assert result["status"] == "unavailable"
    assert result["events"] == []
    assert result["since"] is None


def test_wrap_response_preserves_empty_shape_on_partial():
    result = wrap_response(
        status="partial",
        events=[{"id": 1}],
        missing_sources=["cron_run_log"],
    )
    assert result["status"] == "partial"
    assert len(result["events"]) == 1
    assert result["missing_sources"] == ["cron_run_log"]


@pytest.mark.parametrize("status", ["ready", "partial", "unavailable"])
def test_wrap_response_accepts_all_three_status_values(status):
    result = wrap_response(status=status, events=[])
    assert result["status"] == status


def test_wrap_response_rejects_invalid_status():
    with pytest.raises(ValueError, match="status"):
        wrap_response(status="pending", events=[])  # type: ignore[arg-type]
