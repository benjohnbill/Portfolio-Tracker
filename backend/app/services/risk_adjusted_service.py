"""Risk-adjusted composition — B4 trajectory + B5 scorecard + freeze-time precompute.

Layer 2/3 for the B4/B5/B2 bundle. Consumes BenchmarkService primitives and
PortfolioSnapshot rows to produce the JSONB payload written at freeze time and
the two read-only API payloads served to the frontend.
"""
from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import date, timedelta
from typing import Any, Dict, Optional

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
        """Load PortfolioSnapshot.total_value values indexed by date between [start, end]."""
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

    @staticmethod
    def scorecard(db: Session) -> Dict[str, Any]:
        """B5 endpoint payload — multi-horizon scorecard assembled from risk_metrics JSONB.

        Shape is invariant across ready/not-ready states: all keys present, metric
        values are None when horizon has insufficient data or when maturity gate
        is not yet met.
        """
        snapshots = (
            db.query(WeeklySnapshot)
            .order_by(WeeklySnapshot.snapshot_date.asc())
            .all()
        )
        populated = [
            s for s in snapshots
            if s.risk_metrics and (s.risk_metrics.get("data_quality", {}).get("source") != "unavailable")
        ]
        n_freezes = len(populated)
        n_weeks = n_freezes

        first_freeze_date = populated[0].snapshot_date.isoformat() if populated else None
        ready = n_weeks >= SCORECARD_MATURITY_WEEKS

        def _empty_side() -> Dict[str, Optional[float]]:
            return {"cagr": None, "mdd": None, "sd": None, "sharpe": None, "calmar": None, "sortino": None}

        def _empty_horizon() -> Dict[str, Any]:
            return {"portfolio": _empty_side(), "spy_krw": _empty_side()}

        horizons = {"6M": _empty_horizon(), "1Y": _empty_horizon(), "ITD": _empty_horizon()}

        if ready:
            horizons = RiskAdjustedService._build_horizons(populated)

        return {
            "ready": ready,
            "based_on_freezes": n_freezes,
            "based_on_weeks": n_weeks,
            "first_freeze_date": first_freeze_date,
            "maturity_gate": {
                "required_weeks": SCORECARD_MATURITY_WEEKS,
                "current_weeks": n_weeks,
                "ready": ready,
            },
            "horizons": horizons,
        }

    @staticmethod
    def _build_horizons(populated: list) -> Dict[str, Any]:
        """Aggregate trailing-1Y metrics from JSONB into 6M/1Y/ITD horizons.

        Strategy: use the latest snapshot's 'trailing_1y' directly for '1Y'. For '6M',
        take the most-recent-half subset. For 'ITD', take the first snapshot's trailing_1y.
        """
        def _trailing(s: Any) -> Dict[str, Any]:
            return (s.risk_metrics or {}).get("trailing_1y", {"portfolio": {}, "spy_krw": {}})

        latest = populated[-1]
        first = populated[0]
        mid_index = max(0, len(populated) - max(1, len(populated) // 2))
        mid = populated[mid_index]

        return {
            "6M": _trailing(mid),
            "1Y": _trailing(latest),
            "ITD": _trailing(first),
        }

    @staticmethod
    def calmar_trajectory(db: Session) -> Dict[str, Any]:
        """B4 endpoint payload — one point per populated freeze + decision markers."""
        snapshots = (
            db.query(WeeklySnapshot)
            .order_by(WeeklySnapshot.snapshot_date.asc())
            .all()
        )
        points: list = []
        for s in snapshots:
            rm = s.risk_metrics or {}
            if rm.get("data_quality", {}).get("source") == "unavailable":
                continue
            trailing = rm.get("trailing_1y", {})
            pcal = trailing.get("portfolio", {}).get("calmar")
            scal = trailing.get("spy_krw", {}).get("calmar")
            if pcal is None and scal is None:
                continue
            delta = (pcal - scal) if (pcal is not None and scal is not None) else None
            points.append({
                "date": s.snapshot_date.isoformat(),
                "portfolio_calmar": pcal,
                "spy_krw_calmar": scal,
                "delta": delta,
            })

        decision_markers = RiskAdjustedService._decision_markers_for(db, [p["date"] for p in points])

        n_freezes = len(points)
        ready = n_freezes >= TRAJECTORY_MATURITY_WEEKS

        return {
            "ready": ready,
            "based_on_freezes": n_freezes,
            "required_weeks": TRAJECTORY_MATURITY_WEEKS,
            "points": points,
            "decision_markers": decision_markers,
        }

    @staticmethod
    def _decision_markers_for(db: Session, iso_dates: list) -> list:
        """Build per-freeze decision marker list."""
        if not iso_dates:
            return []
        decisions = (
            db.query(WeeklyDecision)
            .join(WeeklySnapshot, WeeklyDecision.snapshot_id == WeeklySnapshot.id)
            .filter(WeeklySnapshot.snapshot_date.in_(iso_dates))
            .all()
        )
        by_date: Dict[str, list] = {d: [] for d in iso_dates}
        for dec in decisions:
            snap = getattr(dec, "snapshot", None)
            dkey = snap.snapshot_date.isoformat() if snap else None
            if dkey and dkey in by_date:
                by_date[dkey].append({
                    "ticker": dec.asset_ticker,
                    "decision_type": dec.decision_type,
                    "note": (dec.note or "")[:120],
                })
        return [{"date": d, "decisions": by_date[d]} for d in iso_dates if by_date[d]]
