"""Add asset account silo

Revision ID: c4a7c2c9bb21
Revises: 6b2d4c8f9a11
Create Date: 2026-03-27 10:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4a7c2c9bb21'
down_revision: Union[str, Sequence[str], None] = '6b2d4c8f9a11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


account_silo_enum = sa.Enum('ISA_ETF', 'OVERSEAS_ETF', 'BRAZIL_BOND', name='accountsilo')


def upgrade() -> None:
    bind = op.get_bind()
    account_silo_enum.create(bind, checkfirst=True)
    op.add_column('assets', sa.Column('account_silo', account_silo_enum, nullable=True))

    op.execute("UPDATE assets SET account_silo = 'BRAZIL_BOND' WHERE symbol = 'BRAZIL_BOND'")
    op.execute("UPDATE assets SET account_silo = 'ISA_ETF', account_type = 'ISA' WHERE source = 'KR' AND symbol <> 'BRAZIL_BOND'")
    op.execute("UPDATE assets SET account_silo = 'OVERSEAS_ETF' WHERE account_silo IS NULL AND symbol <> 'BRAZIL_BOND'")


def downgrade() -> None:
    op.drop_column('assets', 'account_silo')
    bind = op.get_bind()
    account_silo_enum.drop(bind, checkfirst=True)
