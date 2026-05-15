"""add refresh sessions

Revision ID: 0002_refresh_sessions
Revises: 0001_initial_schema
Create Date: 2026-05-03
"""

from alembic import op

from app.db.metadata import refresh_sessions


revision = "0002_refresh_sessions"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    refresh_sessions.create(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    refresh_sessions.drop(op.get_bind(), checkfirst=True)

