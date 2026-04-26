"""
Verifies track_b_ace_tlt_rename migration:
- Asset id=3 symbol changes from TLT to ACE_TLT
- Asset id=3 name changes to Korean string
- score_service still classifies ACE_TLT as BONDS/CASH (via TLT substring)
- stress_service TICKER_PROXY ACE_TLT key returns TLT
"""
from sqlalchemy import text
from app.services.score_service import asset_to_category
from app.services.stress_service import StressService


def test_ace_tlt_classifies_as_bonds():
    assert asset_to_category("ACE_TLT") == "BONDS/CASH"


def test_stress_proxy_ace_tlt():
    assert StressService.TICKER_PROXY.get("ACE_TLT") == "TLT"


def test_migration_ace_tlt_rename(db_session):
    """Migration SQL renames id=3 from TLT to ACE_TLT with Korean name."""
    # Seed asset id=3 with TLT state (create if not exists)
    existing = db_session.execute(text("SELECT id FROM assets WHERE id=3")).scalar()
    if not existing:
        db_session.execute(text(
            "INSERT INTO assets (id, symbol, code, name, source) VALUES (3, 'TLT', '476760', 'ACE US 30Y Treasury Active', 'KR')"
        ))
    else:
        db_session.execute(text("UPDATE assets SET symbol='TLT', code='476760' WHERE id=3"))
    db_session.commit()

    # Apply migration SQL
    db_session.execute(text("""
        UPDATE assets
        SET symbol = 'ACE_TLT',
            name   = 'ACE 미국30년국채액티브'
        WHERE id = 3
          AND symbol = 'TLT'
          AND code   = '476760'
    """))
    db_session.commit()

    row = db_session.execute(text("SELECT symbol, name FROM assets WHERE id=3")).fetchone()
    assert row.symbol == "ACE_TLT"
    assert row.name == "ACE 미국30년국채액티브"


def test_migration_ace_tlt_idempotent(db_session):
    """Re-run is a no-op when already ACE_TLT."""
    existing = db_session.execute(text("SELECT id FROM assets WHERE id=3")).scalar()
    if not existing:
        db_session.execute(text(
            "INSERT INTO assets (id, symbol, code, name, source) VALUES (3, 'ACE_TLT', '476760', 'ACE 미국30년국채액티브', 'KR')"
        ))
    else:
        db_session.execute(text("UPDATE assets SET symbol='ACE_TLT', code='476760' WHERE id=3"))
    db_session.commit()

    # WHERE symbol='TLT' guard — no rows match, no-op
    db_session.execute(text("""
        UPDATE assets
        SET symbol = 'ACE_TLT',
            name   = 'ACE 미국30년국채액티브'
        WHERE id = 3
          AND symbol = 'TLT'
          AND code   = '476760'
    """))
    db_session.commit()

    row = db_session.execute(text("SELECT symbol FROM assets WHERE id=3")).fetchone()
    assert row.symbol == "ACE_TLT"
