"""Add multi-authority system generalization and case access

Non-destructive. Creates organizations, case_access, and adds multi-authority
fields to users and audit_logs.

Revision ID: e8f9a0b1c2d3
Revises: c9e2a1f4d807
Create Date: 2026-09-23 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, None] = 'c9e2a1f4d807'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create organizations table
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('authority_type', sa.String(length=50), nullable=False),
        sa.Column('jurisdiction', sa.String(length=100), nullable=True),
        sa.Column('parent_organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('org_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['parent_organization_id'], ['organizations.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_organizations_name'), 'organizations', ['name'], unique=True)
    op.create_index(op.f('ix_organizations_code'), 'organizations', ['code'], unique=True)
    op.create_index(op.f('ix_organizations_authority_type'), 'organizations', ['authority_type'], unique=False)

    # 2. Add columns to users table
    op.add_column('users', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('users', sa.Column('designation', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('jurisdiction', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('scope_level', sa.String(length=30), nullable=False, server_default='DISTRICT'))
    op.create_index(op.f('ix_users_organization_id'), 'users', ['organization_id'], unique=False)
    op.create_foreign_key('fk_users_organization_id', 'users', 'organizations', ['organization_id'], ['id'], ondelete='SET NULL')

    # 3. Add columns to audit_logs table
    op.add_column('audit_logs', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('audit_logs', sa.Column('authority_type', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_audit_logs_organization_id'), 'audit_logs', ['organization_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_authority_type'), 'audit_logs', ['authority_type'], unique=False)
    op.create_foreign_key('fk_audit_logs_organization_id', 'audit_logs', 'organizations', ['organization_id'], ['id'], ondelete='SET NULL')

    # 4. Create case_access table
    op.create_table(
        'case_access',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('access_level', sa.String(length=20), nullable=False, server_default='READ'),
        sa.Column('scope', sa.String(length=30), nullable=False, server_default='CASE'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('granted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('granted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['crime_cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['granted_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_case_access_case_id'), 'case_access', ['case_id'], unique=False)
    op.create_index(op.f('ix_case_access_organization_id'), 'case_access', ['organization_id'], unique=False)
    op.create_index(op.f('ix_case_access_status'), 'case_access', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_case_access_status'), table_name='case_access')
    op.drop_index(op.f('ix_case_access_organization_id'), table_name='case_access')
    op.drop_index(op.f('ix_case_access_case_id'), table_name='case_access')
    op.drop_table('case_access')

    op.drop_constraint('fk_audit_logs_organization_id', 'audit_logs', type_='foreignkey')
    op.drop_index(op.f('ix_audit_logs_authority_type'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_organization_id'), table_name='audit_logs')
    op.drop_column('audit_logs', 'authority_type')
    op.drop_column('audit_logs', 'organization_id')

    op.drop_constraint('fk_users_organization_id', 'users', type_='foreignkey')
    op.drop_index(op.f('ix_users_organization_id'), table_name='users')
    op.drop_column('users', 'scope_level')
    op.drop_column('users', 'jurisdiction')
    op.drop_column('users', 'designation')
    op.drop_column('users', 'organization_id')

    op.drop_index(op.f('ix_organizations_authority_type'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_code'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_name'), table_name='organizations')
    op.drop_table('organizations')
