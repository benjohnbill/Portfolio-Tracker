import math
import numpy as np
import pandas as pd
import pytest

from app.services.benchmark_service import BenchmarkService, RiskMetrics


def _steady_growth_returns(n=252, daily_drift=0.0005, vol=0.01, seed=42):
    rng = np.random.default_rng(seed)
    return pd.Series(rng.normal(daily_drift, vol, n))


def test_compute_metrics_happy_path():
    returns = _steady_growth_returns()
    m = BenchmarkService.compute_metrics(returns)
    assert m.n_obs == 252
    assert m.cagr is not None and isinstance(m.cagr, float)
    assert m.mdd is not None and m.mdd <= 0
    assert m.sd is not None and m.sd > 0
    assert m.sharpe is not None
    assert m.calmar is not None
    assert m.sortino is not None


def test_compute_metrics_insufficient_data_below_min_obs():
    returns = pd.Series([0.01] * 19)
    m = BenchmarkService.compute_metrics(returns)
    assert m.n_obs == 19
    assert m.cagr is None
    assert m.mdd is None
    assert m.sd is None
    assert m.sharpe is None
    assert m.calmar is None
    assert m.sortino is None


def test_compute_metrics_exactly_min_obs_passes_gate():
    returns = pd.Series([0.001] * 20)
    m = BenchmarkService.compute_metrics(returns)
    assert m.n_obs == 20
    assert m.cagr is not None


def test_compute_metrics_zero_volatility_returns_no_sharpe():
    returns = pd.Series([0.0] * 252)
    m = BenchmarkService.compute_metrics(returns)
    assert m.n_obs == 252
    assert m.sd == 0.0
    assert m.sharpe is None


def test_compute_metrics_monotonic_growth_returns_no_calmar():
    returns = pd.Series([0.001] * 252)
    m = BenchmarkService.compute_metrics(returns)
    assert m.mdd == 0.0
    assert m.calmar is None


def test_compute_metrics_all_nan_treated_as_empty():
    returns = pd.Series([float("nan")] * 100)
    m = BenchmarkService.compute_metrics(returns)
    assert m.n_obs == 0
    assert m.cagr is None
