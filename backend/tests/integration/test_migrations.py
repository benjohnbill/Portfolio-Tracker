"""Alembic migration head-safety — D track.

The pg_engine fixture creates schema via Base.metadata.create_all() and stamps
alembic_version at head. This test downgrade -1 (removes Phase D columns),
upgrades back to head, and asserts the sentinel columns survive the roundtrip.
"""

from __future__ import annotations

import os

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect


@pytest.mark.integration
def test_migration_roundtrip_preserves_plan_d_columns(pg_engine, pg_url):
    """Downgrade one step, upgrade back to head, verify Phase D columns exist."""

    prior = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = pg_url
    try:
        cfg = Config("alembic.ini")

        command.downgrade(cfg, "-1")
        command.upgrade(cfg, "head")

        insp = inspect(pg_engine)
        cols = {c["name"] for c in insp.get_columns("weekly_decisions")}
        assert "confidence_vs_spy_riskadj" in cols
        assert "confidence_vs_cash" in cols
        assert "confidence_vs_spy_pure" in cols
        assert "expected_failure_mode" in cols
        assert "trigger_threshold" in cols

        snap_cols = {c["name"] for c in insp.get_columns("weekly_snapshots")}
        assert "comment" in snap_cols
    finally:
        if prior is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = prior
