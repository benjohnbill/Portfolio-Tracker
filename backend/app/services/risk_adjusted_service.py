"""Risk-adjusted composition — B4 trajectory + B5 scorecard + freeze-time precompute.

Layer 2/3 for the B4/B5/B2 bundle. Consumes BenchmarkService primitives and
PortfolioSnapshot rows to produce the JSONB payload written at freeze time and
the two read-only API payloads served to the frontend.
"""
from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy.orm import Session

from ..models import PortfolioSnapshot, WeeklyDecision, WeeklySnapshot
from .benchmark_service import BenchmarkService, RiskMetrics

logger = logging.getLogger(__name__)

TRAILING_1Y_DAYS = 365
SCORECARD_MATURITY_WEEKS = 26
TRAJECTORY_MATURITY_WEEKS = 52


class RiskAdjustedService:
    @staticmethod
    def compute_snapshot_metrics(db: Session, snapshot: WeeklySnapshot) -> Dict[str, Any]:
        """Build the weekly_snapshots.risk_metrics JSONB payload for a single freeze.

        Window = trailing 365 calendar days ending on snapshot.snapshot_date.
        On upstream failure, returns a shaped payload with nulls + source='unavailable'.
        """
        as_of: date = snapshot.snapshot_date
        start = as_of - timedelta(days=TRAILING_1Y_DAYS)

        portfolio_series = RiskAdjustedService._load_portfolio_series(db, start, as_of)
        spy_krw_series = BenchmarkService.get_spy_krw_series(db, start, as_of)

        portfolio_ok = portfolio_series is not None and not portfolio_series.empty
        spy_ok = spy_krw_series is not None and not spy_krw_series.empty

        portfolio_returns = portfolio_series.pct_change().dropna() if portfolio_ok else pd.Series(dtype=float)
        spy_returns = spy_krw_series.pct_change().dropna() if spy_ok else pd.Series(dtype=float)

        portfolio_m = BenchmarkService.compute_metrics(portfolio_returns)
        spy_m = BenchmarkService.compute_metrics(spy_returns)

        source = "yfinance+fdr" if (portfolio_ok and spy_ok) else "unavailable"

        return {
            "as_of": as_of.isoformat(),
            "trailing_1y": {
                "portfolio": RiskAdjustedService._metrics_to_dict(portfolio_m),
                "spy_krw": RiskAdjustedService._metrics_to_dict(spy_m),
            },
            "data_quality": {
                "portfolio_days": int(portfolio_series.shape[0]) if portfolio_ok else 0,
                "spy_krw_days": int(spy_krw_series.shape[0]) if spy_ok else 0,
                "source": source,
            },
        }

    @staticmethod
    def _metrics_to_dict(m: RiskMetrics) -> Dict[str, Optional[float]]:
        d = asdict(m)
        d.pop("n_obs", None)
        return d

    @staticmethod
    def _load_portfolio_series(db: Session, start: date, end: date) -> pd.Series:
        """Load PortfolioSnapshot.total_value values indexed by snapshot_date between [start, end]."""
        rows = (
            db.query(PortfolioSnapshot)
            .filter(PortfolioSnapshot.date >= start)
            .filter(PortfolioSnapshot.date <= end)
            .order_by(PortfolioSnapshot.date.asc())
            .all()
        )
        if not rows:
            return pd.Series(dtype=float)
        idx = [pd.Timestamp(r.date) for r in rows]
        vals = [float(getattr(r, "total_value", 0) or 0) for r in rows]
        return pd.Series(vals, index=idx, dtype=float)
