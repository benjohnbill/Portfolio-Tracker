"""Track A — anchor-aware get_equity_curve and cron protection.

When a manual-anchor row exists in portfolio_performance_snapshots:
  1. get_equity_curve must treat the anchor date as performance base
     (performance_value = 100.0 on anchor day) regardless of whether
     transactions on or before that date contain explicit cashflows.
  2. The cron generate_portfolio_snapshots must NOT overwrite the
     manual-anchor row (source_version='manual-anchor-v1').

These guarantees are essential because next-Friday's purchase may be
a pure swap (BUY/SELL only, no DEPOSIT/WITHDRAW), and without the
anchor-aware behavior the performance series would never start.
"""
from datetime import date, datetime, time, timezone

import pandas as pd
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.models import (
    Asset,
    AccountType,
    AccountSilo,
    PortfolioPerformanceSnapshot,
    RawDailyPrice,
    Transaction,
)
from app.services.exchange_service import ExchangeService
from app.services.portfolio_service import PortfolioService
from app.services.ingestion_service import PriceIngestionService


ANCHOR_DATE = date(2026, 4, 25)


def _stub_fx(monkeypatch) -> None:
    monkeypatch.setattr(
        ExchangeService,
        "get_usd_krw_history",
        staticmethod(lambda _start, _end: pd.Series(dtype=float)),
    )


def _seed_portfolio(db_session: Session) -> None:
    """Seed a minimal KR asset + BUY transaction on ANCHOR_DATE.

    No DEPOSIT/WITHDRAW — this is the pure-swap scenario Track A exists to serve.
    Prices are seeded on ANCHOR_DATE so absolute_value_krw > 0 on that day.
    """
    asset = Asset(
        symbol="KODEX_1X",
        code="379810",
        name="KODEX 미국나스닥100",
        source="KR",
        account_type=AccountType.ISA,
        account_silo=AccountSilo.ISA_ETF,
    )
    db_session.add(asset)
    db_session.flush()

    db_session.add(
        Transaction(
            date=datetime.combine(ANCHOR_DATE, time.min),
            asset=asset,
            asset_id=asset.id,
            type="BUY",
            quantity=10.0,
            price=10000.0,
            total_amount=100000.0,
            account_type=AccountType.ISA,
        )
    )
    db_session.add(RawDailyPrice(date=ANCHOR_DATE, ticker="379810", close_price=10000.0))
    db_session.add(RawDailyPrice(date=ANCHOR_DATE, ticker="SPY", close_price=500.0))
    db_session.commit()


def _seed_anchor_row(session: Session) -> None:
    """Seed the manual-anchor row needed for anchor-aware behavior."""
    session.execute(
        sa.text("""
            INSERT INTO portfolio_performance_snapshots
                (date, performance_value, benchmark_value, daily_return, alpha,
                 coverage_start_date, coverage_status, source_version, updated_at)
            SELECT :anchor_date, 100.0, 100.0, 0.0, 0.0,
                   :anchor_date, 'ready', 'manual-anchor-v1', :now
            WHERE NOT EXISTS (
                SELECT 1 FROM portfolio_performance_snapshots WHERE date = :anchor_date
            )
        """),
        {"anchor_date": ANCHOR_DATE, "now": datetime.now(timezone.utc)},
    )
    session.commit()


def test_get_equity_curve_uses_anchor_as_performance_base(db_session: Session, monkeypatch):
    """If a manual-anchor row exists, the day's performance_value in the
    returned history is 100.0 (anchor base)."""
    _stub_fx(monkeypatch)
    _seed_portfolio(db_session)
    _seed_anchor_row(db_session)

    history = PortfolioService.get_equity_curve(db_session, period="all")
    assert history, "get_equity_curve must return non-empty history"

    anchor_day = next(
        (d for d in history if d["date"] == ANCHOR_DATE.isoformat()),
        None,
    )
    assert anchor_day is not None, (
        f"Anchor date {ANCHOR_DATE} must appear in equity curve history"
    )
    assert anchor_day.get("performance_value") == pytest.approx(100.0), (
        f"Performance value at anchor must be 100.0 base, got {anchor_day.get('performance_value')}"
    )
    assert anchor_day.get("performance_coverage_status") == "ready"


def test_generate_snapshots_preserves_manual_anchor(db_session: Session, monkeypatch):
    """Running the cron after the anchor exists must not overwrite the
    anchor row's manual-anchor-v1 source."""
    _stub_fx(monkeypatch)
    _seed_portfolio(db_session)
    _seed_anchor_row(db_session)

    anchor_before = db_session.query(PortfolioPerformanceSnapshot).filter(
        PortfolioPerformanceSnapshot.date == ANCHOR_DATE
    ).first()
    assert anchor_before is not None
    assert anchor_before.source_version == "manual-anchor-v1"
    original_perf_value = anchor_before.performance_value
    original_source = anchor_before.source_version

    # Act: run the cron that re-generates snapshots.
    PriceIngestionService.generate_portfolio_snapshots(db_session)
    db_session.commit()

    # Assert: anchor row preserved.
    anchor_after = db_session.query(PortfolioPerformanceSnapshot).filter(
        PortfolioPerformanceSnapshot.date == ANCHOR_DATE
    ).first()
    assert anchor_after is not None
    assert anchor_after.source_version == original_source, (
        f"Anchor source must remain 'manual-anchor-v1', got {anchor_after.source_version!r}"
    )
    assert anchor_after.performance_value == pytest.approx(original_perf_value), (
        "Anchor performance_value must be preserved by cron"
    )
