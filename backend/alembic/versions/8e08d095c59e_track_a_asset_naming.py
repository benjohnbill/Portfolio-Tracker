"""Track A asset naming migration

Revision ID: 8e08d095c59e
Revises: d2c4f6a8b901
Create Date: 2026-04-25

- Rename Asset id=1 from placeholder symbol "QQQ" to semantic "KODEX_1X"
  and Korean-localise its name.
- Insert new Asset row for TIGER_2X (code 418660), the KR 2x leveraged
  NDX ETF, in ISA / ISA_ETF.

Both changes are idempotent (use UPDATE WHERE and INSERT WHERE NOT EXISTS).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e08d095c59e'
down_revision: Union[str, Sequence[str], None] = 'd2c4f6a8b901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Migrate Asset id=1: QQQ -> KODEX_1X, Korean name
    op.execute(
        sa.text("""
            UPDATE assets
            SET symbol = 'KODEX_1X',
                name = 'KODEX 미국나스닥100'
            WHERE id = 1 AND symbol = 'QQQ' AND code = '379810'
        """)
    )

    # 2. Insert TIGER_2X if not present (idempotent)
    op.execute(
        sa.text("""
            INSERT INTO assets (symbol, code, name, source, account_type, account_silo)
            SELECT 'TIGER_2X', '418660', 'TIGER 미국나스닥100레버리지(합성)',
                   'KR', 'ISA', 'ISA_ETF'
            WHERE NOT EXISTS (
                SELECT 1 FROM assets WHERE code = '418660'
            )
        """)
    )


def downgrade() -> None:
    # Remove TIGER_2X
    op.execute(sa.text("DELETE FROM assets WHERE code = '418660'"))

    # Revert id=1 to placeholder symbol
    op.execute(
        sa.text("""
            UPDATE assets
            SET symbol = 'QQQ',
                name = 'KODEX Nasdaq100 TR'
            WHERE id = 1 AND symbol = 'KODEX_1X'
        """)
    )
