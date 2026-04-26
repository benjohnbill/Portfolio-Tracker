"""track_b_brazil_bond_name

Localises the display name of BRAZIL_BOND (id=14) to the ISIN identifier.
Symbol unchanged — only name field updated.

Deploy gate: Apply after B1-1 (track_b_ace_tlt_rename / 9278bdcb796c) on production.

Revision ID: 08a8ebea1f16
Revises: 9278bdcb796c
Create Date: 2026-04-26 12:26:49.213162

"""
from alembic import op

revision = '08a8ebea1f16'
down_revision = '9278bdcb796c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE assets
        SET name = 'BNTNF 10 01/01/37 NTNF'
        WHERE id = 14
          AND symbol = 'BRAZIL_BOND'
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE assets
        SET name = 'BRAZIL_BOND'
        WHERE id = 14
          AND symbol = 'BRAZIL_BOND'
    """)
