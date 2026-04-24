from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import patch

import pandas as pd

from app.models import (
    DecisionOutcome,
    PortfolioPerformanceSnapshot,
    PortfolioSnapshot,
    WeeklyDecision,
    WeeklySnapshot,
)
from app.services.benchmark_service import RiskMetrics
from app.services.intelligence_service import IntelligenceService
from app.services.risk_adjusted_service import RiskAdjustedService


def _add_archive_snapshot(db_session, when: date, total_value: float) -> None:
    db_session.add(
        PortfolioSnapshot(
            date=when,
            total_value=total_value,
            invested_capital=total_value,
            cash_balance=0,
        )
    )


def _add_performance_snapshot(db_session, when: date, value: float) -> None:
    db_session.add(
        PortfolioPerformanceSnapshot(
            date=when,
            performance_value=value,
            benchmark_value=value,
            daily_return=0,
            alpha=0,
            coverage_start_date=when,
            coverage_status="ready",
            source_version="test",
        )
    )


def _add_weekly_snapshot(db_session, when: date) -> WeeklySnapshot:
    snapshot = WeeklySnapshot(
        snapshot_date=when,
        created_at=datetime.now(timezone.utc),
        frozen_report={
            "score": {"total": 70},
            "macroSnapshot": {"buckets": [{"state": "neutral"}]},
        },
        snapshot_metadata={},
    )
    db_session.add(snapshot)
    db_session.flush()
    return snapshot


def test_risk_metrics_refuse_archive_snapshot_fallback(db_session):
    as_of = date(2026, 4, 17)
    snapshot = _add_weekly_snapshot(db_session, as_of)
    _add_archive_snapshot(db_session, as_of, 9_999_999)
    db_session.commit()

    with patch("app.services.risk_adjusted_service.BenchmarkService") as MockBench:
        MockBench.get_spy_krw_series.return_value = pd.Series(
            [100.0, 101.0],
            index=pd.to_datetime([as_of.replace(day=16), as_of]),
        )
        MockBench.compute_metrics.return_value = RiskMetrics(None, None, None, None, None, None, n_obs=0)

        payload = RiskAdjustedService.compute_snapshot_metrics(db_session, snapshot)

    assert payload["data_quality"]["source"] == "unavailable"
    assert payload["data_quality"]["portfolio_days"] == 0
    assert payload["trailing_1y"]["portfolio"]["cagr"] is None


def test_risk_metrics_use_persisted_performance_rows_not_archive_totals(db_session):
    as_of = date(2026, 4, 17)
    snapshot = _add_weekly_snapshot(db_session, as_of)
    start = as_of.replace(day=15)
    _add_archive_snapshot(db_session, start, 100_000)
    _add_archive_snapshot(db_session, as_of, 1_000_000)
    _add_performance_snapshot(db_session, start, 100_000)
    _add_performance_snapshot(db_session, as_of, 110_000)
    db_session.commit()

    with patch("app.services.risk_adjusted_service.BenchmarkService") as MockBench:
        MockBench.get_spy_krw_series.return_value = pd.Series(
            [100.0, 101.0],
            index=pd.to_datetime([start, as_of]),
        )
        MockBench.compute_metrics.side_effect = [
            RiskMetrics(0.1, -0.1, 0.2, 0.5, 1.0, 0.6, n_obs=1),
            RiskMetrics(0.01, -0.01, 0.02, 0.4, 1.0, 0.5, n_obs=1),
        ]

        payload = RiskAdjustedService.compute_snapshot_metrics(db_session, snapshot)

    assert payload["data_quality"]["source"] == "yfinance+fdr"
    assert payload["data_quality"]["portfolio_days"] == 2
    assert payload["trailing_1y"]["portfolio"]["cagr"] == 0.1


def test_intelligence_outcomes_skip_when_performance_coverage_missing(db_session):
    decision_date = date(2025, 1, 1)
    snapshot = _add_weekly_snapshot(db_session, decision_date)
    db_session.add(
        WeeklyDecision(
            snapshot_id=snapshot.id,
            decision_type="hold",
            asset_ticker="QQQ",
            note="hold",
            confidence_vs_spy_riskadj=7,
        )
    )
    _add_archive_snapshot(db_session, decision_date, 100_000)
    _add_archive_snapshot(db_session, date(2025, 1, 8), 150_000)
    db_session.commit()

    created = IntelligenceService.evaluate_decision_outcomes(db_session)

    assert created == 0
    assert db_session.query(DecisionOutcome).count() == 0


def test_intelligence_outcomes_use_performance_values_not_archive_totals(db_session):
    decision_date = date(2025, 1, 1)
    horizon_date = date(2025, 1, 8)
    snapshot = _add_weekly_snapshot(db_session, decision_date)
    db_session.add(
        WeeklyDecision(
            snapshot_id=snapshot.id,
            decision_type="hold",
            asset_ticker="QQQ",
            note="hold",
            confidence_vs_spy_riskadj=7,
        )
    )
    _add_archive_snapshot(db_session, decision_date, 100_000)
    _add_archive_snapshot(db_session, horizon_date, 150_000)
    _add_performance_snapshot(db_session, decision_date, 100_000)
    _add_performance_snapshot(db_session, horizon_date, 110_000)
    db_session.commit()

    created = IntelligenceService.evaluate_decision_outcomes(db_session)

    assert created > 0
    outcomes = db_session.query(DecisionOutcome).all()
    assert outcomes
    assert {outcome.portfolio_value_at_decision for outcome in outcomes} == {100_000}
    assert {outcome.portfolio_value_at_horizon for outcome in outcomes} == {110_000}
    assert {outcome.outcome_delta_pct for outcome in outcomes} == {10.0}
