from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from app.services.benchmark_service import RiskMetrics
from app.services.risk_adjusted_service import RiskAdjustedService


class _Snap:
    def __init__(self, snapshot_date, risk_metrics=None):
        self.snapshot_date = snapshot_date
        self.risk_metrics = risk_metrics
        self.id = 1


def _mk_portfolio_series(n=252):
    idx = pd.date_range(end="2026-04-17", periods=n, freq="B")
    return pd.Series(range(10_000_000, 10_000_000 + n * 100, 100), index=idx, dtype=float)


def _mk_spy_krw_series(n=252):
    idx = pd.date_range(end="2026-04-17", periods=n, freq="B")
    return pd.Series(range(500_000, 500_000 + n * 50, 50), index=idx, dtype=float)


def test_compute_snapshot_metrics_happy_path_shape():
    snap = _Snap(date(2026, 4, 17))
    db = MagicMock()
    with patch("app.services.risk_adjusted_service.BenchmarkService") as MockBench, \
         patch("app.services.risk_adjusted_service.RiskAdjustedService._load_portfolio_series") as mock_load:
        mock_load.return_value = _mk_portfolio_series()
        MockBench.get_spy_krw_series.return_value = _mk_spy_krw_series()
        MockBench.compute_metrics.side_effect = [
            RiskMetrics(0.12, -0.18, 0.22, 0.55, 0.67, 0.8, n_obs=252),
            RiskMetrics(0.08, -0.15, 0.18, 0.44, 0.53, 0.6, n_obs=250),
        ]
        payload = RiskAdjustedService.compute_snapshot_metrics(db, snap)

    assert payload["as_of"] == "2026-04-17"
    assert "trailing_1y" in payload
    assert set(payload["trailing_1y"].keys()) == {"portfolio", "spy_krw"}
    for side in ("portfolio", "spy_krw"):
        assert set(payload["trailing_1y"][side].keys()) == \
            {"cagr", "mdd", "sd", "sharpe", "calmar", "sortino"}
    assert payload["data_quality"]["portfolio_days"] == 252
    assert payload["data_quality"]["spy_krw_days"] == 252
    assert payload["data_quality"]["source"] == "yfinance+fdr"


def test_compute_snapshot_metrics_upstream_failure_marks_unavailable():
    snap = _Snap(date(2026, 4, 17))
    db = MagicMock()
    with patch("app.services.risk_adjusted_service.BenchmarkService") as MockBench, \
         patch("app.services.risk_adjusted_service.RiskAdjustedService._load_portfolio_series") as mock_load:
        mock_load.return_value = pd.Series(dtype=float)
        MockBench.get_spy_krw_series.return_value = pd.Series(dtype=float)
        MockBench.compute_metrics.return_value = RiskMetrics(None, None, None, None, None, None, n_obs=0)
        payload = RiskAdjustedService.compute_snapshot_metrics(db, snap)

    assert payload["data_quality"]["source"] == "unavailable"
    assert payload["data_quality"]["portfolio_days"] == 0
    assert payload["data_quality"]["spy_krw_days"] == 0
    assert payload["trailing_1y"]["portfolio"]["cagr"] is None
    assert payload["trailing_1y"]["spy_krw"]["cagr"] is None
