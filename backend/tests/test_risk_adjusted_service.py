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


# ---------------------------------------------------------------------------
# Task 5: scorecard (B5)
# ---------------------------------------------------------------------------

def test_scorecard_empty_db_ready_false_shape_stable():
    db = MagicMock()
    db.query.return_value.order_by.return_value.all.return_value = []

    payload = RiskAdjustedService.scorecard(db)

    assert payload["ready"] is False
    assert payload["based_on_freezes"] == 0
    assert payload["based_on_weeks"] == 0
    assert payload["first_freeze_date"] is None
    assert payload["maturity_gate"] == {"required_weeks": 26, "current_weeks": 0, "ready": False}
    assert set(payload["horizons"].keys()) == {"6M", "1Y", "ITD"}
    for h in ("6M", "1Y", "ITD"):
        assert set(payload["horizons"][h].keys()) == {"portfolio", "spy_krw"}
        for side in ("portfolio", "spy_krw"):
            for key in ("cagr", "mdd", "sd", "sharpe", "calmar", "sortino"):
                assert payload["horizons"][h][side][key] is None


def _fake_snapshot_row(d, metrics_payload):
    return _Snap(d, risk_metrics=metrics_payload)


def _populated_snapshots(n_weeks):
    base = date(2025, 10, 17)
    out = []
    for i in range(n_weeks):
        sd = base + timedelta(weeks=i)
        out.append(_fake_snapshot_row(sd, {
            "as_of": sd.isoformat(),
            "trailing_1y": {
                "portfolio": {"cagr": 0.1 + i * 0.001, "mdd": -0.15, "sd": 0.2, "sharpe": 0.5, "calmar": 0.6, "sortino": 0.7},
                "spy_krw":   {"cagr": 0.08, "mdd": -0.12, "sd": 0.18, "sharpe": 0.4, "calmar": 0.5, "sortino": 0.6},
            },
            "data_quality": {"portfolio_days": 252, "spy_krw_days": 250, "source": "yfinance+fdr"},
        }))
    return out


def test_scorecard_thirty_weeks_ready_true_and_horizons_populated():
    snapshots = _populated_snapshots(30)
    db = MagicMock()
    db.query.return_value.order_by.return_value.all.return_value = snapshots

    payload = RiskAdjustedService.scorecard(db)

    assert payload["ready"] is True
    assert payload["based_on_weeks"] == 30
    assert payload["maturity_gate"]["ready"] is True
    assert payload["horizons"]["1Y"]["portfolio"]["cagr"] is not None
    assert payload["first_freeze_date"] == "2025-10-17"


def test_scorecard_skips_unavailable_source_freezes_in_count():
    populated = _populated_snapshots(25)
    unavailable = _fake_snapshot_row(date(2025, 10, 10), {
        "as_of": "2025-10-10",
        "trailing_1y": {"portfolio": {}, "spy_krw": {}},
        "data_quality": {"portfolio_days": 0, "spy_krw_days": 0, "source": "unavailable"},
    })
    snapshots = [unavailable] + populated
    db = MagicMock()
    db.query.return_value.order_by.return_value.all.return_value = snapshots

    payload = RiskAdjustedService.scorecard(db)

    assert payload["based_on_freezes"] == 25  # unavailable row excluded
    assert payload["ready"] is False  # 25 < 26 gate
