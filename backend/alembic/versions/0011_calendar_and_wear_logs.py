"""add outfit calendar and wear logs

Revision ID: 0011_calendar_and_wear_logs
Revises: 0010_outfit_collections
Create Date: 2026-05-24
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_calendar_and_wear_logs"
down_revision = "0010_outfit_collections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "outfit_calendar_entries",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("user_id", sa.String(length=48), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("outfit_id", sa.String(length=48), sa.ForeignKey("outfits.id", ondelete="CASCADE"), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="planned"),
        sa.Column("weather_snapshot_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "date", name="uq_outfit_calendar_entries_user_date"),
        sa.CheckConstraint(
            "status IN ('planned', 'worn', 'skipped')",
            name="ck_outfit_calendar_entries_status",
        ),
    )
    op.create_index(
        "ix_outfit_calendar_entries_user_date",
        "outfit_calendar_entries",
        ["user_id", "date"],
        unique=False,
    )

    op.create_table(
        "outfit_wear_logs",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("user_id", sa.String(length=48), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("outfit_id", sa.String(length=48), sa.ForeignKey("outfits.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "calendar_entry_id",
            sa.String(length=48),
            sa.ForeignKey("outfit_calendar_entries.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("worn_date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("weather_snapshot_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "source IN ('calendar_confirmation', 'manual_outfit', 'weekly_checkin')",
            name="ck_outfit_wear_logs_source",
        ),
    )
    op.create_index("ix_outfit_wear_logs_user_worn_date", "outfit_wear_logs", ["user_id", "worn_date"], unique=False)

    op.create_table(
        "item_wear_logs",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("user_id", sa.String(length=48), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", sa.String(length=48), sa.ForeignKey("wardrobe_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("outfit_id", sa.String(length=48), sa.ForeignKey("outfits.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "calendar_entry_id",
            sa.String(length=48),
            sa.ForeignKey("outfit_calendar_entries.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("worn_date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "source IN ('calendar_confirmation', 'manual_outfit', 'weekly_checkin')",
            name="ck_item_wear_logs_source",
        ),
    )
    op.create_index("ix_item_wear_logs_user_worn_date", "item_wear_logs", ["user_id", "worn_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_item_wear_logs_user_worn_date", table_name="item_wear_logs")
    op.drop_table("item_wear_logs")
    op.drop_index("ix_outfit_wear_logs_user_worn_date", table_name="outfit_wear_logs")
    op.drop_table("outfit_wear_logs")
    op.drop_index("ix_outfit_calendar_entries_user_date", table_name="outfit_calendar_entries")
    op.drop_table("outfit_calendar_entries")
