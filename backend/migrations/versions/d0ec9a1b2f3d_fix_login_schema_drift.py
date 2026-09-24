"""Fix login-blocking schema drift (users/audit_logs)

Additive, non-destructive. The shared DB was created out-of-band from an
older model snapshot, so a small set of model columns/indexes never landed
while the ``users`` table exists alongside Supabase's own ``auth.users`` in a
different schema. This migration only adds what is missing and is guarded so
it is a no-op on a fresh database built from the full migration chain.

Revision ID: d0ec9a1b2f3d
Revises: e8f9a0b1c2d3
Create Date: 2026-09-24 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd0ec9a1b2f3d'
down_revision: Union[str, None] = 'e8f9a0b1c2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns(table)}
    return column in cols


def upgrade() -> None:
    bind = op.get_bind()
    pg_uuid = postgresql.UUID(as_uuid=True)

    # ---- users -----------------------------------------------------------
    if not _has_column(bind, "users", "designation"):
        op.add_column("users", sa.Column("designation", sa.String(length=100), nullable=True))
    if not _has_column(bind, "users", "jurisdiction"):
        op.add_column("users", sa.Column("jurisdiction", sa.String(length=100), nullable=True))
    if not _has_column(bind, "users", "organization_id"):
        op.add_column("users", sa.Column("organization_id", pg_uuid, nullable=True))
    if not _has_column(bind, "users", "scope_level"):
        op.add_column(
            "users",
            sa.Column("scope_level", sa.String(length=30), nullable=True, server_default="DISTRICT"),
        )
        op.alter_column("users", "scope_level", nullable=False)

    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_role_id ON users (role_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_organization_id ON users (organization_id)")

    # ---- audit_logs ------------------------------------------------------
    if not _has_column(bind, "audit_logs", "authority_type"):
        op.add_column("audit_logs", sa.Column("authority_type", sa.String(length=50), nullable=True))
    if not _has_column(bind, "audit_logs", "organization_id"):
        op.add_column("audit_logs", sa.Column("organization_id", pg_uuid, nullable=True))

    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_authority_type ON audit_logs (authority_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_organization_id ON audit_logs (organization_id)")


def downgrade() -> None:
    bind = op.get_bind()

    op.execute("DROP INDEX IF EXISTS ix_audit_logs_organization_id")
    op.execute("DROP INDEX IF EXISTS ix_audit_logs_authority_type")
    op.execute("DROP INDEX IF EXISTS ix_audit_logs_user_id")
    if _has_column(bind, "audit_logs", "organization_id"):
        op.drop_column("audit_logs", "organization_id")
    if _has_column(bind, "audit_logs", "authority_type"):
        op.drop_column("audit_logs", "authority_type")

    op.execute("DROP INDEX IF EXISTS ix_users_organization_id")
    op.execute("DROP INDEX IF EXISTS ix_users_role_id")
    op.execute("DROP INDEX IF EXISTS ix_users_email")
    op.execute("DROP INDEX IF EXISTS ix_users_username")
    for col in ("scope_level", "organization_id", "jurisdiction", "designation"):
        if _has_column(bind, "users", col):
            op.drop_column("users", col)