"""Track A — Asset migration verification.

After the migration runs, asset id=1 must have symbol="KODEX_1X" and a Korean
name, and a new asset must exist for TIGER_2X / 418660.

The C-track db_session uses fresh in-memory SQLite, so this test:
1. Seeds the pre-migration state (id=1 as "QQQ" placeholder).
2. Applies the migration SQL inline via the session.
3. Asserts the post-migration state.

This validates the migration logic is correct independently of alembic's
version tracking against the live Postgres DB.
"""
import sqlalchemy as sa
from sqlalchemy.orm import Session

from app.models import Asset, AccountType, AccountSilo
from tests.fixtures.seeds import seed_asset


def _run_upgrade(session: Session) -> None:
    """Apply the track_a_asset_naming upgrade SQL to the given session."""
    # 1. Migrate Asset id=1: QQQ -> KODEX_1X, Korean name
    session.execute(
        sa.text("""
            UPDATE assets
            SET symbol = 'KODEX_1X',
                name = 'KODEX 미국나스닥100'
            WHERE id = 1 AND symbol = 'QQQ' AND code = '379810'
        """)
    )

    # 2. Insert TIGER_2X if not present (idempotent)
    session.execute(
        sa.text("""
            INSERT INTO assets (symbol, code, name, source, account_type, account_silo)
            SELECT 'TIGER_2X', '418660', 'TIGER 미국나스닥100레버리지(합성)',
                   'KR', 'ISA', 'ISA_ETF'
            WHERE NOT EXISTS (
                SELECT 1 FROM assets WHERE code = '418660'
            )
        """)
    )
    session.commit()


def _run_downgrade(session: Session) -> None:
    """Apply the track_a_asset_naming downgrade SQL to the given session."""
    session.execute(sa.text("DELETE FROM assets WHERE code = '418660'"))
    session.execute(
        sa.text("""
            UPDATE assets
            SET symbol = 'QQQ',
                name = 'KODEX Nasdaq100 TR'
            WHERE id = 1 AND symbol = 'KODEX_1X'
        """)
    )
    session.commit()


def test_kodex_1x_migration_applied(db_session: Session):
    """Asset id=1 has been renamed from placeholder QQQ to semantic KODEX_1X."""
    # Seed pre-migration state: id=1 placeholder asset
    seed_asset(
        db_session,
        symbol="QQQ",
        code="379810",
        name="KODEX Nasdaq100 TR",
        source="KR",
        account_type=AccountType.ISA,
        account_silo=AccountSilo.ISA_ETF,
    )

    _run_upgrade(db_session)

    asset = db_session.query(Asset).filter(Asset.id == 1).first()
    assert asset is not None, "Asset id=1 must exist (KODEX 미국나스닥100)"
    assert asset.symbol == "KODEX_1X", (
        f"Asset id=1 symbol must be 'KODEX_1X' after migration, got {asset.symbol!r}"
    )
    assert asset.name == "KODEX 미국나스닥100", (
        f"Asset id=1 name must be Korean full name, got {asset.name!r}"
    )
    assert asset.code == "379810"
    assert asset.source == "KR"


def test_tiger_2x_asset_created(db_session: Session):
    """TIGER_2X asset row exists with correct fields."""
    # Seed pre-migration state: id=1 placeholder asset
    seed_asset(
        db_session,
        symbol="QQQ",
        code="379810",
        name="KODEX Nasdaq100 TR",
        source="KR",
        account_type=AccountType.ISA,
        account_silo=AccountSilo.ISA_ETF,
    )

    _run_upgrade(db_session)

    asset = db_session.query(Asset).filter(Asset.code == "418660").first()
    assert asset is not None, "Asset with code 418660 must exist after migration"
    assert asset.symbol == "TIGER_2X"
    assert asset.name == "TIGER 미국나스닥100레버리지(합성)"
    assert asset.source == "KR"
    assert asset.account_type == AccountType.ISA
    assert asset.account_silo == AccountSilo.ISA_ETF


def test_migration_is_idempotent(db_session: Session):
    """Running upgrade twice produces the same result — no error, no duplicates."""
    seed_asset(
        db_session,
        symbol="QQQ",
        code="379810",
        name="KODEX Nasdaq100 TR",
        source="KR",
        account_type=AccountType.ISA,
        account_silo=AccountSilo.ISA_ETF,
    )

    _run_upgrade(db_session)
    _run_upgrade(db_session)  # second run must be a no-op

    count_tiger = (
        db_session.query(Asset).filter(Asset.code == "418660").count()
    )
    assert count_tiger == 1, "TIGER_2X must appear exactly once after double upgrade"

    asset_id1 = db_session.query(Asset).filter(Asset.id == 1).first()
    assert asset_id1.symbol == "KODEX_1X"


def test_downgrade_reverts_state(db_session: Session):
    """Downgrade restores id=1 to QQQ and removes TIGER_2X."""
    seed_asset(
        db_session,
        symbol="QQQ",
        code="379810",
        name="KODEX Nasdaq100 TR",
        source="KR",
        account_type=AccountType.ISA,
        account_silo=AccountSilo.ISA_ETF,
    )

    _run_upgrade(db_session)
    _run_downgrade(db_session)

    asset_id1 = db_session.query(Asset).filter(Asset.id == 1).first()
    assert asset_id1 is not None
    assert asset_id1.symbol == "QQQ"

    tiger = db_session.query(Asset).filter(Asset.code == "418660").first()
    assert tiger is None, "TIGER_2X must be gone after downgrade"
