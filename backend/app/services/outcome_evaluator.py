"""Decision-outcome evaluator — populates SPY-KRW delta columns on matured outcomes.

Layer 2 write-path for the B2 axis. Runs as the last non-blocking step of the
Sunday cron. Idempotent: only targets rows where evaluated_at IS NOT NULL AND
outcome_delta_vs_spy_pure IS NULL.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Dict, Optional

import pandas as pd
from sqlalchemy.orm import Session

from ..models import DecisionOutcome
from .benchmark_service import BenchmarkService

logger = logging.getLogger(__name__)


HORIZON_DELTA_DAYS = {
    "1w": 7,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
}


class OutcomeEvaluatorService:
    @staticmethod
    def backfill_spy_deltas(db: Session) -> Dict[str, int]:
        """Walk matured DecisionOutcome rows with NULL SPY delta and populate both delta columns.

        Returns a summary dict: {processed, skipped_insufficient_data, errors}.
        Does NOT raise — per-row failures log + increment errors.
        """
        rows = (
            db.query(DecisionOutcome)
            .filter(DecisionOutcome.evaluated_at.isnot(None))
            .filter(DecisionOutcome.outcome_delta_vs_spy_pure.is_(None))
            .all()
        )
        processed = 0
        skipped = 0
        errors = 0

        for row in rows:
            try:
                snap = getattr(row, "snapshot", None)
                if snap is None:
                    skipped += 1
                    continue
                d0: date = snap.snapshot_date
                offset = HORIZON_DELTA_DAYS.get(row.horizon)
                if offset is None:
                    skipped += 1
                    continue
                d1: date = d0 + timedelta(days=offset)

                spy = BenchmarkService.get_spy_krw_series(db, d0 - timedelta(days=5), d1 + timedelta(days=5))
                if spy is None or spy.empty:
                    skipped += 1
                    continue

                spy_at_d0 = OutcomeEvaluatorService._asof(spy, d0)
                spy_at_d1 = OutcomeEvaluatorService._asof(spy, d1)
                if spy_at_d0 is None or spy_at_d1 is None or spy_at_d0 == 0:
                    skipped += 1
                    continue

                spy_return = (spy_at_d1 / spy_at_d0) - 1.0
                portfolio_return = row.outcome_delta_pct if row.outcome_delta_pct is not None else None
                if portfolio_return is None:
                    skipped += 1
                    continue

                row.outcome_delta_vs_spy_pure = float(portfolio_return - spy_return)
                row.outcome_delta_calmar_vs_spy = OutcomeEvaluatorService._calmar_delta(spy, d0, d1, portfolio_return)
                processed += 1

            except Exception as exc:
                errors += 1
                logger.warning("backfill_spy_deltas: row failed (%s)", exc)
                continue

        if processed:
            try:
                db.commit()
            except Exception as exc:
                logger.exception("backfill_spy_deltas: commit failed (%s)", exc)
                errors += 1

        return {"processed": processed, "skipped_insufficient_data": skipped, "errors": errors}

    @staticmethod
    def _asof(series: pd.Series, target: date) -> Optional[float]:
        ts = pd.Timestamp(target)
        try:
            val = series.asof(ts)
        except Exception:
            return None
        if pd.isna(val):
            return None
        return float(val)

    @staticmethod
    def _calmar_delta(spy: pd.Series, d0: date, d1: date, portfolio_return: float) -> Optional[float]:
        """Rough Calmar-delta proxy over the horizon window.

        Uses SPY Calmar over the window with sign preserved relative to portfolio.
        A richer per-outcome computation is a future refinement.
        """
        window = spy.loc[pd.Timestamp(d0):pd.Timestamp(d1)].dropna()
        if window.empty:
            return None
        returns = window.pct_change().dropna()
        m = BenchmarkService.compute_metrics(returns)
        if m.calmar is None:
            return None
        return float(portfolio_return - m.calmar)
