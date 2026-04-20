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
        mdd = float(drawdown.min())

        sharpe = None
        if sd_annual > 0:
            sharpe = (mean_daily * TRADING_DAYS_PER_YEAR - risk_free) / sd_annual

        calmar = None
        if mdd < 0 and cagr is not None:
            calmar = cagr / abs(mdd)

        downside = arr[arr < 0]
        sortino = None
        if downside.size > 0:
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
