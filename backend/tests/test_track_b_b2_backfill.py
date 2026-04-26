"""
Verifies B2 migration SQL logic for:
  - track_b_backfill_20260320_prices (66469081d5b6)
  - track_b_qqq_compensating_sell (1c1a7e367634)

Tests apply migration SQL directly against in-memory SQLite — not via alembic
run — so they work in the C-track test environment without a live alembic chain.
"""
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — register all mappers before create_all
from app.database import Base


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_engine():
    """Create a fresh in-memory SQLite engine with all base tables."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


def _seed_assets(session: Session, count: int = 3) -> None:
    """Insert `count` minimal asset rows to satisfy FK constraints."""
    for i in range(1, count + 1):
        session.execute(text(
            "INSERT INTO assets (symbol, code, name, source) "
            "VALUES (:sym, :code, :name, 'KR')"
        ), {"sym": f"ASSET_{i}", "code": f"CODE_{i}", "name": f"Asset {i}"})
    session.commit()


def _seed_transactions_for_backfill(session: Session) -> None:
    """Seed 11 transaction rows so that auto-increment IDs match production.

    IDs 1-6: dummy BUY rows with price=100 (already filled, must not be touched).
    IDs 7-10: BUY rows with price=0 and qty/total matching the confirmed data.
    ID 11:  SELL row with price=0 (CSI300, no data — must remain untouched).
    """
    # Rows 1-6: already-filled dummy rows
    for _ in range(6):
        session.execute(text(
            "INSERT INTO transactions "
            "(date, asset_id, type, quantity, price, total_amount, account_type) "
            "VALUES ('2026-01-01', 1, 'BUY', 10, 100.0, 1000.0, 'OVERSEAS')"
        ))
    session.commit()

    # Row 7: NDX_1X — 34 shares, price=0 → should become 24315.0 / 826710.0
    session.execute(text(
        "INSERT INTO transactions "
        "(date, asset_id, type, quantity, price, total_amount, account_type) "
        "VALUES ('2026-03-20', 1, 'BUY', 34, 0, 0, 'OVERSEAS')"
    ))
    # Row 8: ACE_TLT — 24 shares, price=0 → should become 10225.0 / 245400.0
    session.execute(text(
        "INSERT INTO transactions "
        "(date, asset_id, type, quantity, price, total_amount, account_type) "
        "VALUES ('2026-03-20', 2, 'BUY', 24, 0, 0, 'OVERSEAS')"
    ))
    # Row 9: DBMF — 16.95 shares, price=0 → should become 42503.54 / 720630.0
    session.execute(text(
        "INSERT INTO transactions "
        "(date, asset_id, type, quantity, price, total_amount, account_type) "
        "VALUES ('2026-03-20', 3, 'BUY', 16.95, 0, 0, 'OVERSEAS')"
    ))
    # Row 10: MSTR — 2.88 shares, price=0 → should become 149686.81 / 431098.0
    session.execute(text(
        "INSERT INTO transactions "
        "(date, asset_id, type, quantity, price, total_amount, account_type) "
        "VALUES ('2026-03-20', 1, 'BUY', 2.88, 0, 0, 'OVERSEAS')"
    ))
    # Row 11: CSI300 SELL — price=0, no data, must remain untouched
    session.execute(text(
        "INSERT INTO transactions "
        "(date, asset_id, type, quantity, price, total_amount, account_type) "
        "VALUES ('2026-03-20', 2, 'SELL', 137, 0, 0, 'OVERSEAS')"
    ))
    session.commit()


# SQL extracted from upgrade() of track_b_backfill_20260320_prices
_BACKFILL_SQL = [
    ("UPDATE transactions SET price = 24315.0, total_amount = 826710.0 WHERE id = 7 AND price = 0", 7, 24315.0, 826710.0),
    ("UPDATE transactions SET price = 10225.0, total_amount = 245400.0 WHERE id = 8 AND price = 0", 8, 10225.0, 245400.0),
    ("UPDATE transactions SET price = 42503.54, total_amount = 720630.0 WHERE id = 9 AND price = 0", 9, 42503.54, 720630.0),
    ("UPDATE transactions SET price = 149686.81, total_amount = 431098.0 WHERE id = 10 AND price = 0", 10, 149686.81, 431098.0),
]

_COMPENSATING_INSERT_SQL = """
    INSERT INTO transactions (date, asset_id, type, quantity, price, total_amount, account_type, note)
    SELECT '2026-04-15', 1, 'SELL', 2, 25310.0, 50620.0, 'ISA', 'operator-error-correction-v1'
    WHERE NOT EXISTS (
        SELECT 1 FROM transactions WHERE note = 'operator-error-correction-v1'
    )
"""

_COMPENSATING_DELETE_SQL = (
    "DELETE FROM transactions WHERE note = 'operator-error-correction-v1'"
)


# ---------------------------------------------------------------------------
# Migration 1 tests — track_b_backfill_20260320_prices
# ---------------------------------------------------------------------------

def test_backfill_updates_price_for_ids_7_to_10(db_session):
    """After applying migration 1 SQL, ids 7-10 have correct price/total_amount."""
    _seed_assets(db_session, count=3)
    _seed_transactions_for_backfill(db_session)

    for sql, _id, _price, _total in _BACKFILL_SQL:
        db_session.execute(text(sql))
    db_session.commit()

    for _sql, row_id, expected_price, expected_total in _BACKFILL_SQL:
        row = db_session.execute(
            text("SELECT price, total_amount FROM transactions WHERE id = :id"),
            {"id": row_id},
        ).fetchone()
        assert row is not None, f"Row id={row_id} not found"
        assert abs(row.price - expected_price) < 0.01, (
            f"id={row_id}: expected price {expected_price}, got {row.price}"
        )
        assert abs(row.total_amount - expected_total) < 0.01, (
            f"id={row_id}: expected total_amount {expected_total}, got {row.total_amount}"
        )

    # id=11 must remain untouched (price=0)
    row11 = db_session.execute(
        text("SELECT price, total_amount FROM transactions WHERE id = 11")
    ).fetchone()
    assert row11 is not None, "Row id=11 not found"
    assert row11.price == 0, f"id=11 should remain price=0, got {row11.price}"
    assert row11.total_amount == 0, (
        f"id=11 should remain total_amount=0, got {row11.total_amount}"
    )


def test_backfill_is_idempotent(db_session):
    """Applying migration 1 SQL twice yields the same result as once."""
    _seed_assets(db_session, count=3)
    _seed_transactions_for_backfill(db_session)

    # Apply once
    for sql, *_ in _BACKFILL_SQL:
        db_session.execute(text(sql))
    db_session.commit()

    # Apply again — WHERE price=0 guards prevent overwrite
    for sql, *_ in _BACKFILL_SQL:
        db_session.execute(text(sql))
    db_session.commit()

    for _sql, row_id, expected_price, expected_total in _BACKFILL_SQL:
        row = db_session.execute(
            text("SELECT price, total_amount FROM transactions WHERE id = :id"),
            {"id": row_id},
        ).fetchone()
        assert abs(row.price - expected_price) < 0.01, (
            f"id={row_id} idempotency: expected price {expected_price}, got {row.price}"
        )
        assert abs(row.total_amount - expected_total) < 0.01, (
            f"id={row_id} idempotency: expected total {expected_total}, got {row.total_amount}"
        )


# ---------------------------------------------------------------------------
# Migration 2 tests — track_b_qqq_compensating_sell
# (Uses a separate engine that includes the note column via DDL)
# ---------------------------------------------------------------------------

@pytest.fixture
def db_with_note():
    """Session on an in-memory DB with all transaction columns including note."""
    engine = _make_engine()
    with Session(engine) as session:
        # Seed one asset so FK on asset_id=1 resolves
        session.execute(text(
            "INSERT INTO assets (symbol, code, name, source) "
            "VALUES ('NDX_1X', '379810', 'NDX 1X', 'KR')"
        ))
        session.commit()
        yield session
    engine.dispose()


def test_compensating_sell_inserts_row(db_with_note):
    """INSERT SQL creates exactly one row with the correct field values."""
    db_with_note.execute(text(_COMPENSATING_INSERT_SQL))
    db_with_note.commit()

    row = db_with_note.execute(
        text("SELECT * FROM transactions WHERE note = 'operator-error-correction-v1'")
    ).fetchone()
    assert row is not None, "Compensating SELL row not found"
    assert row.type == "SELL"
    assert row.quantity == 2
    assert abs(row.price - 25310.0) < 0.01
    assert abs(row.total_amount - 50620.0) < 0.01
    assert row.account_type == "ISA"


def test_compensating_sell_is_idempotent(db_with_note):
    """Applying the INSERT SQL twice results in exactly one row."""
    db_with_note.execute(text(_COMPENSATING_INSERT_SQL))
    db_with_note.commit()
    db_with_note.execute(text(_COMPENSATING_INSERT_SQL))
    db_with_note.commit()

    count = db_with_note.execute(
        text("SELECT COUNT(*) FROM transactions WHERE note = 'operator-error-correction-v1'")
    ).scalar()
    assert count == 1, f"Expected 1 row after idempotent insert, got {count}"


def test_compensating_sell_downgrade_removes_row(db_with_note):
    """After insert then downgrade DELETE, the row is gone."""
    db_with_note.execute(text(_COMPENSATING_INSERT_SQL))
    db_with_note.commit()

    # Verify it exists first
    count_before = db_with_note.execute(
        text("SELECT COUNT(*) FROM transactions WHERE note = 'operator-error-correction-v1'")
    ).scalar()
    assert count_before == 1

    # Apply downgrade
    db_with_note.execute(text(_COMPENSATING_DELETE_SQL))
    db_with_note.commit()

    count_after = db_with_note.execute(
        text("SELECT COUNT(*) FROM transactions WHERE note = 'operator-error-correction-v1'")
    ).scalar()
    assert count_after == 0, f"Expected 0 rows after downgrade delete, got {count_after}"
