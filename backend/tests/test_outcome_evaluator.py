from datetime import date, datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from app.services.outcome_evaluator import OutcomeEvaluatorService


class _Outcome:
    def __init__(self, horizon, decision_date, horizon_date, portfolio_delta_pct):
        self.horizon = horizon
        self.evaluated_at = datetime(2026, 4, 1, tzinfo=timezone.utc)
        self.outcome_delta_pct = portfolio_delta_pct
        self.outcome_delta_vs_spy_pure = None
        self.outcome_delta_calmar_vs_spy = None
        self.snapshot = MagicMock(snapshot_date=decision_date)
        self._horizon_date = horizon_date


def _fake_spy_series(start, end, anchor=500_000.0, drift=100.0):
    idx = pd.date_range(start, end, freq="B")
    return pd.Series([anchor + i * drift for i in range(len(idx))], index=idx, dtype=float)


def test_backfill_spy_deltas_happy_path_processes_null_rows():
    d0 = date(2025, 1, 3)
    d1 = date(2025, 2, 3)
    rows = [
        _Outcome("1m", d0, d1, portfolio_delta_pct=0.05),
        _Outcome("1m", d0, d1, portfolio_delta_pct=0.03),
        _Outcome("1m", d0, d1, portfolio_delta_pct=0.04),
    ]
    db = MagicMock()
    db.query.return_value.filter.return_value.filter.return_value.all.return_value = rows

    with patch("app.services.outcome_evaluator.BenchmarkService") as MockBench:
        MockBench.get_spy_krw_series.return_value = _fake_spy_series(d0, d1)
        result = OutcomeEvaluatorService.backfill_spy_deltas(db)

    assert result["processed"] == 3
    assert result["errors"] == 0
    for r in rows:
        assert r.outcome_delta_vs_spy_pure is not None
        assert r.outcome_delta_calmar_vs_spy is not None


def test_backfill_spy_deltas_idempotent_no_work_on_already_populated():
    d0 = date(2025, 1, 3)
    d1 = date(2025, 2, 3)
    rows = [_Outcome("1m", d0, d1, portfolio_delta_pct=0.05)]
    rows[0].outcome_delta_vs_spy_pure = 0.02  # already populated
    db = MagicMock()
    # Filter should exclude already-populated rows — simulate by returning empty list.
    db.query.return_value.filter.return_value.filter.return_value.all.return_value = []

    with patch("app.services.outcome_evaluator.BenchmarkService"):
        result = OutcomeEvaluatorService.backfill_spy_deltas(db)

    assert result["processed"] == 0
    assert result["errors"] == 0
    assert result["skipped_insufficient_data"] == 0


def test_backfill_spy_deltas_upstream_failure_preserves_null_no_raise():
    d0 = date(2025, 1, 3)
    d1 = date(2025, 2, 3)
    rows = [_Outcome("1m", d0, d1, portfolio_delta_pct=0.05)]
    db = MagicMock()
    db.query.return_value.filter.return_value.filter.return_value.all.return_value = rows

    with patch("app.services.outcome_evaluator.BenchmarkService") as MockBench:
        MockBench.get_spy_krw_series.return_value = pd.Series(dtype=float)
        result = OutcomeEvaluatorService.backfill_spy_deltas(db)

    assert result["processed"] == 0
    assert result["skipped_insufficient_data"] == 1
    assert rows[0].outcome_delta_vs_spy_pure is None
    assert rows[0].outcome_delta_calmar_vs_spy is None


def test_backfill_spy_deltas_unknown_horizon_skipped():
    d0 = date(2025, 1, 3)
    rows = [_Outcome("ninety_year", d0, d0 + timedelta(days=1), portfolio_delta_pct=0.01)]
    db = MagicMock()
    db.query.return_value.filter.return_value.filter.return_value.all.return_value = rows

    with patch("app.services.outcome_evaluator.BenchmarkService"):
        result = OutcomeEvaluatorService.backfill_spy_deltas(db)

    assert result["skipped_insufficient_data"] == 1
