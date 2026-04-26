"""
Verifies B1 Migration 0 (track_b_ndx_symbol_revision):
- score_service classifies NDX_1X and NDX_2X as NDX
- stress_service TICKER_PROXY has NDX_1X and NDX_2X keys (not KODEX_1X / TIGER_2X)
- Migration SQL correctly renames id=1 and id=5, with idempotency guard
"""
from sqlalchemy import text
from app.services.score_service import asset_to_category
from app.services.stress_service import StressService


def test_ndx_1x_classifies_as_ndx():
    assert asset_to_category("NDX_1X") == "NDX"


def test_ndx_2x_classifies_as_ndx():
    assert asset_to_category("NDX_2X") == "NDX"


def test_ticker_proxy_has_ndx_1x():
    assert "NDX_1X" in StressService.TICKER_PROXY
    assert StressService.TICKER_PROXY["NDX_1X"] == "QQQ"


def test_ticker_proxy_has_ndx_2x():
    assert "NDX_2X" in StressService.TICKER_PROXY


def test_ticker_proxy_no_kodex_1x():
    assert "KODEX_1X" not in StressService.TICKER_PROXY


def test_ticker_proxy_no_tiger_2x():
    assert "TIGER_2X" not in StressService.TICKER_PROXY


def test_migration_ndx_revision(db_session):
    """Migration SQL applies cleanly and sets correct final state."""
    # Seed minimal assets to get rows with id=1 and id=5.
    # Insert 5 rows; SQLite auto-increments from 1.
    for i in range(1, 6):
        db_session.execute(text(
            "INSERT INTO assets (symbol, code, name, source) "
            "VALUES (:sym, :code, :name, 'KR')"
        ), {"sym": f"ASSET_{i}", "code": f"CODE_{i}", "name": f"Asset {i}"})
    db_session.commit()

    # Seed pre-migration state (KODEX_1X, TIGER_2X)
    db_session.execute(text("UPDATE assets SET symbol='KODEX_1X' WHERE id=1"))
    db_session.execute(text("UPDATE assets SET symbol='TIGER_2X' WHERE id=5"))
    db_session.commit()

    # Apply Migration 0 SQL
    db_session.execute(text(
        "UPDATE assets SET symbol='NDX_1X' WHERE id=1 AND symbol='KODEX_1X'"
    ))
    db_session.execute(text(
        "UPDATE assets SET symbol='NDX_2X' WHERE id=5 AND symbol='TIGER_2X'"
    ))
    db_session.commit()

    r1 = db_session.execute(text("SELECT symbol FROM assets WHERE id=1")).scalar()
    r5 = db_session.execute(text("SELECT symbol FROM assets WHERE id=5")).scalar()
    assert r1 == "NDX_1X", f"Expected NDX_1X, got {r1}"
    assert r5 == "NDX_2X", f"Expected NDX_2X, got {r5}"


def test_migration_ndx_revision_idempotent(db_session):
    """Re-running migration SQL is a no-op when symbols already updated."""
    for i in range(1, 6):
        db_session.execute(text(
            "INSERT INTO assets (symbol, code, name, source) "
            "VALUES (:sym, :code, :name, 'KR')"
        ), {"sym": f"ASSET_{i}", "code": f"CODE_{i}", "name": f"Asset {i}"})
    db_session.commit()

    db_session.execute(text("UPDATE assets SET symbol='NDX_1X' WHERE id=1"))
    db_session.execute(text("UPDATE assets SET symbol='NDX_2X' WHERE id=5"))
    db_session.commit()

    # Re-run — WHERE guards prevent double-update
    db_session.execute(text(
        "UPDATE assets SET symbol='NDX_1X' WHERE id=1 AND symbol='KODEX_1X'"
    ))
    db_session.execute(text(
        "UPDATE assets SET symbol='NDX_2X' WHERE id=5 AND symbol='TIGER_2X'"
    ))
    db_session.commit()

    r1 = db_session.execute(text("SELECT symbol FROM assets WHERE id=1")).scalar()
    r5 = db_session.execute(text("SELECT symbol FROM assets WHERE id=5")).scalar()
    assert r1 == "NDX_1X"
    assert r5 == "NDX_2X"
