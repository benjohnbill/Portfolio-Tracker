"""track_b_ace_tlt_rename

Renames asset id=3 from TLT to ACE_TLT with Korean display name.

Deploy gate: Apply after Track A migrations (8e08d095c59e, 393b0d9c9ffd)
and after B1-0 (track_b_ndx_symbol_revision / 9faba9444413) are applied on production.

Revision ID: 9278bdcb796c
Revises: 9faba9444413
Create Date: 2026-04-26 12:23:33.106871

"""
from alembic import op

revision = '9278bdcb796c'
down_revision = '9faba9444413'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE assets
        SET symbol = 'ACE_TLT',
            name   = 'ACE 미국30년국채액티브'
        WHERE id = 3
          AND symbol = 'TLT'
          AND code   = '476760'
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE assets
        SET symbol = 'TLT',
            name   = 'ACE US 30Y Treasury Active'
        WHERE id = 3
          AND symbol = 'ACE_TLT'
          AND code   = '476760'
    """)
