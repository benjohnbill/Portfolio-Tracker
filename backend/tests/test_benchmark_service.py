from datetime import date as _date
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd

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


def _fake_spy_usd_series():
    idx = pd.date_range("2025-01-01", periods=250, freq="B")
    return pd.Series(range(100, 350), index=idx, dtype=float)


def _fake_fx_series():
    idx = pd.date_range("2025-01-01", periods=250, freq="B")
    return pd.Series([1350.0] * 250, index=idx, dtype=float)


def test_get_spy_krw_series_cache_miss_composes_upstreams():
    db = MagicMock()
    with patch("app.services.benchmark_service.CacheService") as MockCache, \
         patch("app.services.benchmark_service.PriceService") as MockPrice, \
         patch("app.services.benchmark_service.ExchangeService") as MockFx:
        MockCache.get_cache.return_value = None
        MockPrice.get_historical_prices.return_value = _fake_spy_usd_series()
        MockFx.get_usd_krw_history.return_value = _fake_fx_series()

        series = BenchmarkService.get_spy_krw_series(db, _date(2025, 1, 1), _date(2025, 12, 31))

    assert isinstance(series, pd.Series)
    assert len(series) == 250
    assert float(series.iloc[0]) == 100.0 * 1350.0
    MockPrice.get_historical_prices.assert_called_once()
    MockFx.get_usd_krw_history.assert_called_once()
    MockCache.set_cache.assert_called_once()


def test_get_spy_krw_series_cache_hit_skips_upstreams():
    db = MagicMock()
    cached_payload = {"2025-01-02": 135000.0, "2025-01-03": 135500.0}
    with patch("app.services.benchmark_service.CacheService") as MockCache, \
         patch("app.services.benchmark_service.PriceService") as MockPrice, \
         patch("app.services.benchmark_service.ExchangeService") as MockFx:
        MockCache.get_cache.return_value = cached_payload

        series = BenchmarkService.get_spy_krw_series(db, _date(2025, 1, 1), _date(2025, 1, 5))

    assert len(series) == 2
    MockPrice.get_historical_prices.assert_not_called()
    MockFx.get_usd_krw_history.assert_not_called()


def test_get_spy_krw_series_upstream_empty_returns_empty_series():
    db = MagicMock()
    with patch("app.services.benchmark_service.CacheService") as MockCache, \
         patch("app.services.benchmark_service.PriceService") as MockPrice, \
         patch("app.services.benchmark_service.ExchangeService") as MockFx:
        MockCache.get_cache.return_value = None
        MockPrice.get_historical_prices.return_value = pd.Series(dtype=float)
        MockFx.get_usd_krw_history.return_value = _fake_fx_series()

        series = BenchmarkService.get_spy_krw_series(db, _date(2025, 1, 1), _date(2025, 12, 31))

    assert isinstance(series, pd.Series)
    assert series.empty
    MockCache.set_cache.assert_not_called()


def test_get_spy_krw_series_inner_join_drops_misaligned_dates():
    db = MagicMock()
    spy_idx = pd.date_range("2025-01-01", periods=5, freq="B")
    fx_idx = pd.date_range("2025-01-02", periods=5, freq="B")
    spy_series = pd.Series([100.0] * 5, index=spy_idx)
    fx_series = pd.Series([1350.0] * 5, index=fx_idx)
    with patch("app.services.benchmark_service.CacheService") as MockCache, \
         patch("app.services.benchmark_service.PriceService") as MockPrice, \
         patch("app.services.benchmark_service.ExchangeService") as MockFx:
        MockCache.get_cache.return_value = None
        MockPrice.get_historical_prices.return_value = spy_series
        MockFx.get_usd_krw_history.return_value = fx_series

        series = BenchmarkService.get_spy_krw_series(db, _date(2025, 1, 1), _date(2025, 1, 10))

    assert len(series) == 4  # intersection, not union
