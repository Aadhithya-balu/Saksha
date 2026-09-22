"""Add AlertFinding (Phase 5 analytics review workflow)

Non-destructive. Creates only the `alert_findings` table so the rule-driven
finding lifecycle (crime spikes, repeat offenders) can persist reviews.

Revision ID: c9e2a1f4d807
Revises: 67c8dab87ac9
Create Date: 2026-09-22 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c9e2a1f4d807'
down_revision: Union[str, None] = '67c8dab87ac9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'alert_findings',
        sa.Column('finding_type', sa.String(length=30), nullable=False),
        sa.Column('district', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('entity_type', sa.String(length=20), nullable=True),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('confidence', sa.String(length=30), nullable=False),
        sa.Column('provenance', sa.String(length=20), nullable=False),
        sa.Column('current_count', sa.Integer(), nullable=False),
        sa.Column('baseline_count', sa.Float(), nullable=False),
        sa.Column('spike_ratio', sa.Float(), nullable=False),
        sa.Column('evidence', sa.JSON(), nullable=False),
        sa.Column('time_window', sa.JSON(), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=False),
        sa.Column('grouping_key', sa.String(length=255), nullable=True),
        sa.Column('observation_count', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('reviewed_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_decision', sa.String(length=20), nullable=True),
        sa.Column('review_note', sa.Text(), nullable=True),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['reviewed_by_id'], ['users.id'], name='fk_alert_findings_reviewed_by_id'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_alert_findings_finding_type'), 'alert_findings', ['finding_type'], unique=False)
    op.create_index(op.f('ix_alert_findings_district'), 'alert_findings', ['district'], unique=False)
    op.create_index(op.f('ix_alert_findings_entity_id'), 'alert_findings', ['entity_id'], unique=False)
    op.create_index(op.f('ix_alert_findings_severity'), 'alert_findings', ['severity'], unique=False)
    op.create_index(op.f('ix_alert_findings_grouping_key'), 'alert_findings', ['grouping_key'], unique=False)
    op.create_index(op.f('ix_alert_findings_status'), 'alert_findings', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_alert_findings_status'), table_name='alert_findings')
    op.drop_index(op.f('ix_alert_findings_grouping_key'), table_name='alert_findings')
    op.drop_index(op.f('ix_alert_findings_severity'), table_name='alert_findings')
    op.drop_index(op.f('ix_alert_findings_entity_id'), table_name='alert_findings')
    op.drop_index(op.f('ix_alert_findings_district'), table_name='alert_findings')
    op.drop_index(op.f('ix_alert_findings_finding_type'), table_name='alert_findings')
    op.drop_table('alert_findings')