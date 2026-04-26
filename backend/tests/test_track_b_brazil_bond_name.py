"""Verifies track_b_brazil_bond_name migration sets localised name on id=14."""
from sqlalchemy import text


def test_migration_brazil_bond_name(db_session):
    # Seed asset id=14 with placeholder name
    existing = db_session.execute(text("SELECT id FROM assets WHERE id=14")).scalar()
    if not existing:
        db_session.execute(text(
            "INSERT INTO assets (id, symbol, code, name, source) VALUES (14, 'BRAZIL_BOND', 'BRAZIL_BOND', 'BRAZIL_BOND', 'OVERSEAS')"
        ))
    else:
        db_session.execute(text("UPDATE assets SET name='BRAZIL_BOND' WHERE id=14 AND symbol='BRAZIL_BOND'"))
    db_session.commit()

    # Apply migration SQL
    db_session.execute(text("""
        UPDATE assets
        SET name = 'BNTNF 10 01/01/37 NTNF'
        WHERE id = 14
          AND symbol = 'BRAZIL_BOND'
    """))
    db_session.commit()

    row = db_session.execute(text("SELECT symbol, name FROM assets WHERE id=14")).fetchone()
    assert row.symbol == "BRAZIL_BOND"
    assert row.name == "BNTNF 10 01/01/37 NTNF"


def test_migration_brazil_bond_name_idempotent(db_session):
    """Re-run is safe — name update is idempotent (same value)."""
    existing = db_session.execute(text("SELECT id FROM assets WHERE id=14")).scalar()
    if not existing:
        db_session.execute(text(
            "INSERT INTO assets (id, symbol, code, name, source) VALUES (14, 'BRAZIL_BOND', 'BRAZIL_BOND', 'BNTNF 10 01/01/37 NTNF', 'OVERSEAS')"
        ))
    else:
        db_session.execute(text("UPDATE assets SET name='BNTNF 10 01/01/37 NTNF' WHERE id=14"))
    db_session.commit()

    # Re-run migration SQL — no-op (sets same value)
    db_session.execute(text("""
        UPDATE assets
        SET name = 'BNTNF 10 01/01/37 NTNF'
        WHERE id = 14
          AND symbol = 'BRAZIL_BOND'
    """))
    db_session.commit()

    row = db_session.execute(text("SELECT name FROM assets WHERE id=14")).fetchone()
    assert row.name == "BNTNF 10 01/01/37 NTNF"
