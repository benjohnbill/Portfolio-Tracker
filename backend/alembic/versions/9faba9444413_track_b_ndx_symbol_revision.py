"""track_b_ndx_symbol_revision

Revises the NDX ETF symbol convention: KODEX_1X -> NDX_1X, TIGER_2X -> NDX_2X.
Convention moves from {ISSUER}_{LEVERAGE} to {INDEX}_{MULTIPLIER}.

Deploy gate: Apply ONLY after Track A migrations 8e08d095c59e + 393b0d9c9ffd
are confirmed on production (those migrations set KODEX_1X and TIGER_2X).
"""
from alembic import op

revision = '9faba9444413'
down_revision = '393b0d9c9ffd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE assets SET symbol = 'NDX_1X' WHERE id = 1 AND symbol = 'KODEX_1X'"
    )
    # Use code (stable KRX identifier) rather than id — TIGER_2X is inserted by
    # Track A with auto-increment id which differs between environments.
    op.execute(
        "UPDATE assets SET symbol = 'NDX_2X' WHERE code = '418660' AND symbol = 'TIGER_2X'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE assets SET symbol = 'KODEX_1X' WHERE id = 1 AND symbol = 'NDX_1X'"
    )
    op.execute(
        "UPDATE assets SET symbol = 'TIGER_2X' WHERE code = '418660' AND symbol = 'NDX_2X'"
    )
