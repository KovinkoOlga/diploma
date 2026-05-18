"""add outfit cover mode and editor state

Revision ID: 0005_outfit_cover_editor_state
Revises: 0004_update_wardrobe_categories
Create Date: 2026-05-17
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_outfit_cover_editor_state"
down_revision = "0004_update_wardrobe_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("outfits")}

    if "cover_mode" not in columns:
        op.add_column(
            "outfits",
            sa.Column("cover_mode", sa.String(length=24), nullable=False, server_default="none"),
        )
        op.alter_column("outfits", "cover_mode", server_default=None)

    if "cover_editor_state_json" not in columns:
        op.add_column("outfits", sa.Column("cover_editor_state_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("outfits", "cover_editor_state_json")
    op.drop_column("outfits", "cover_mode")
