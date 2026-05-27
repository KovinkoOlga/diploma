"""add editor file to item drafts

Revision ID: 0012_item_draft_editor_file
Revises: 0011_calendar_and_wear_logs
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa


revision = "0012_item_draft_editor_file"
down_revision = "0011_calendar_and_wear_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("item_drafts")}
    foreign_keys = {foreign_key["name"] for foreign_key in inspector.get_foreign_keys("item_drafts")}

    if "editor_file_id" not in columns:
        op.add_column("item_drafts", sa.Column("editor_file_id", sa.String(length=48), nullable=True))
    if "fk_item_drafts_editor_file_id" not in foreign_keys:
        op.create_foreign_key("fk_item_drafts_editor_file_id", "item_drafts", "files", ["editor_file_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_item_drafts_editor_file_id", "item_drafts", type_="foreignkey")
    op.drop_column("item_drafts", "editor_file_id")
