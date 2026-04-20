"""Benchmark primitives — SPY-KRW series composition + pure risk-metric computation.

Layer 1 of the B4/B5/B2 bundle. This file holds no Layer 2 composition logic:
callers (risk_adjusted_service, outcome_evaluator) are responsible for
assembling payloads and choosing horizons.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import date
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from .cache_service import CacheService
from .exchange_service import ExchangeService
from .price_service import PriceService

logger = logging.getLogger(__name__)

TRADING_DAYS_PER_YEAR = 252
MIN_OBS = 20


@dataclass(frozen=True)
class RiskMetrics:
    cagr: Optional[float]
    mdd: Optional[float]
    sd: Optional[float]
    sharpe: Optional[float]
    calmar: Optional[float]
    sortino: Optional[float]
    n_obs: int


class BenchmarkService:
    @staticmethod
    def compute_metrics(returns: pd.Series, risk_free: float = 0.0) -> RiskMetrics:
        """Pure computation of trailing risk metrics from a daily-return Series.

        Contract:
            - n_obs = count of finite values in `returns`.
            - When n_obs < MIN_OBS (20): all metric fields None, n_obs truthful.
            - sharpe = None when sd == 0 (degenerate zero-variance series).
            - calmar = None when mdd == 0 (no drawdown observed).
            - Does not touch DB; pure function over a Series.
        """
        clean = returns.dropna()
        n = int(clean.shape[0])

        if n < MIN_OBS:
            return RiskMetrics(None, None, None, None, None, None, n)

        arr = clean.to_numpy()
        mean_daily = float(arr.mean())
        sd_daily = float(arr.std(ddof=1))
        sd_annual = sd_daily * math.sqrt(TRADING_DAYS_PER_YEAR)

        cumulative = (1.0 + clean).cumprod()
        years = n / TRADING_DAYS_PER_YEAR
        cagr = float(cumulative.iloc[-1] ** (1.0 / years) - 1.0) if years > 0 else None

        running_max = cumulative.cummax()
        drawdown = (cumulative / running_max) - 1.0
        mdd_raw = float(drawdown.min())
        mdd = None if math.isnan(mdd_raw) else mdd_raw

        sharpe = None
        if sd_annual > 0:
            sharpe = (mean_daily * TRADING_DAYS_PER_YEAR - risk_free) / sd_annual

        calmar = None
        if mdd is not None and mdd < 0 and cagr is not None:
            calmar = cagr / abs(mdd)

        downside = arr[arr < 0]
        sortino = None
        if downside.size >= 2:
            downside_sd_annual = float(downside.std(ddof=1)) * math.sqrt(TRADING_DAYS_PER_YEAR)
            if downside_sd_annual > 0:
                sortino = (mean_daily * TRADING_DAYS_PER_YEAR - risk_free) / downside_sd_annual

        return RiskMetrics(
            cagr=cagr,
            mdd=mdd,
            sd=sd_annual,
            sharpe=sharpe,
            calmar=calmar,
            sortino=sortino,
            n_obs=n,
        )

    CACHE_KEY_PREFIX = "spy_krw_series"

    @staticmethod
    def get_spy_krw_series(db: Session, start: date, end: date) -> pd.Series:
        """SPY daily close (USD) * USDKRW daily close, inner-joined on trading dates.

        Cached via SystemCache with effective 1-hour TTL by including `today` in the key
        for same-day-ending ranges (so a new day naturally invalidates). Returns an empty
        Series on upstream failure; callers must graceful-degrade.
        """
        cache_key = f"{BenchmarkService.CACHE_KEY_PREFIX}_{start.isoformat()}_{end.isoformat()}"
        cached = CacheService.get_cache(db, cache_key)
        if cached:
            try:
                series = pd.Series(
                    {pd.Timestamp(k): float(v) for k, v in cached.items()}
                ).sort_index()
                return series
            except Exception as exc:
                logger.warning("SPY-KRW cache decode failed (%s); refetching", exc)

        spy_usd = PriceService.get_historical_prices(
            "SPY", start.isoformat(), end.isoformat(), source="US"
        )
        fx = ExchangeService.get_usd_krw_history(start.isoformat(), end.isoformat())

        if spy_usd is None or fx is None:
            return pd.Series(dtype=float)
        if getattr(spy_usd, "empty", True) or getattr(fx, "empty", True):
            return pd.Series(dtype=float)

        joined = pd.concat([spy_usd, fx], axis=1, join="inner").dropna()
        if joined.empty:
            return pd.Series(dtype=float)

        joined.columns = ["spy_usd", "fx"]
        spy_krw = (joined["spy_usd"] * joined["fx"]).astype(float)
        spy_krw.name = "spy_krw"

        try:
            payload = {ts.strftime("%Y-%m-%d"): float(v) for ts, v in spy_krw.items()}
            CacheService.set_cache(db, cache_key, payload)
        except Exception as exc:
            logger.warning("SPY-KRW cache write failed (%s); proceeding without cache", exc)

        return spy_krw
