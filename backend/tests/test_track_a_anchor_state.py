"""Track A — anchor row state verification.

After the anchor migration runs, both portfolio_snapshots and
portfolio_performance_snapshots must contain a row at 2026-04-25 with the
locked values from the spec.

The C-track db_session uses fresh in-memory SQLite, so this test applies
migration SQL inline via _run_upgrade/_run_downgrade helpers (same pattern
as test_track_a_asset_state.py).
"""
from datetime import date, datetime, timezone

import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.models import PortfolioSnapshot, PortfolioPerformanceSnapshot


ANCHOR_DATE = date(2026, 4, 25)


def _run_upgrade(session: Session) -> None:
    """Apply the track_a_anchor_rows upgrade SQL to the given session."""
    session.execute(
        sa.text("""
            INSERT INTO portfolio_snapshots (date, total_value, invested_capital, cash_balance)
            SELECT :anchor_date, 21353133.0, 21253002.0, 100131.0
            WHERE NOT EXISTS (
                SELECT 1 FROM portfolio_snapshots WHERE date = :anchor_date
            )
        """),
        {"anchor_date": ANCHOR_DATE},
    )
    session.execute(
        sa.text("""
            UPDATE portfolio_snapshots
            SET total_value = 21353133.0,
                invested_capital = 21253002.0,
                cash_balance = 100131.0
            WHERE date = :anchor_date
        """),
        {"anchor_date": ANCHOR_DATE},
    )
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


def _run_downgrade(session: Session) -> None:
    """Apply the track_a_anchor_rows downgrade SQL to the given session."""
    session.execute(
        sa.text("""
            DELETE FROM portfolio_performance_snapshots
            WHERE date = :anchor_date AND source_version = 'manual-anchor-v1'
        """),
        {"anchor_date": ANCHOR_DATE},
    )
    session.commit()


def test_archive_anchor_row(db_session: Session):
    _run_upgrade(db_session)
    row = db_session.query(PortfolioSnapshot).filter(
        PortfolioSnapshot.date == ANCHOR_DATE
    ).first()
    assert row is not None, "Archive anchor row must exist at 2026-04-25"
    assert row.total_value == 21353133.0
    assert row.invested_capital == 21253002.0
    assert row.cash_balance == 100131.0


def test_performance_anchor_row(db_session: Session):
    _run_upgrade(db_session)
    row = db_session.query(PortfolioPerformanceSnapshot).filter(
        PortfolioPerformanceSnapshot.date == ANCHOR_DATE
    ).first()
    assert row is not None, "Performance anchor row must exist at 2026-04-25"
    assert row.performance_value == 100.0
    assert row.benchmark_value == 100.0
    assert row.daily_return == 0.0
    assert row.alpha == 0.0
    assert row.coverage_start_date == ANCHOR_DATE
    assert row.coverage_status == "ready"
    assert row.source_version == "manual-anchor-v1"


def test_archive_anchor_idempotent(db_session: Session):
    _run_upgrade(db_session)
    _run_upgrade(db_session)  # second run must be a no-op
    rows = db_session.query(PortfolioSnapshot).filter(
        PortfolioSnapshot.date == ANCHOR_DATE
    ).all()
    assert len(rows) == 1, f"Archive anchor must appear exactly once, got {len(rows)}"
    assert rows[0].total_value == 21353133.0


def test_performance_anchor_downgrade_removes_only_manual(db_session: Session):
    _run_upgrade(db_session)
    _run_downgrade(db_session)
    row = db_session.query(PortfolioPerformanceSnapshot).filter(
        PortfolioPerformanceSnapshot.date == ANCHOR_DATE
    ).first()
    assert row is None, "Performance anchor with manual-anchor-v1 source must be removed"
