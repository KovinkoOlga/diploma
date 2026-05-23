"""add outfit collections

Revision ID: 0010_outfit_collections
Revises: 0009_season_item_cleanup
Create Date: 2026-05-23
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_outfit_collections"
down_revision = "0009_season_item_cleanup"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "outfit_collections",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("user_id", sa.String(length=48), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("normalized_name", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "normalized_name", name="uq_outfit_collections_user_name"),
    )
    op.create_table(
        "outfit_collection_outfits",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("outfit_id", sa.String(length=48), sa.ForeignKey("outfits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("collection_id", sa.String(length=48), sa.ForeignKey("outfit_collections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("outfit_id", "collection_id", name="uq_outfit_collection_outfits_pair"),
    )


def downgrade() -> None:
    op.drop_table("outfit_collection_outfits")
    op.drop_table("outfit_collections")
