"""extend item drafts for ml pipeline

Revision ID: 0003_item_draft_ml_pipeline
Revises: 0002_refresh_sessions
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_item_draft_ml_pipeline"
down_revision = "0002_refresh_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("item_drafts")}
    foreign_keys = {foreign_key["name"] for foreign_key in inspector.get_foreign_keys("item_drafts")}

    if "mask_file_id" not in columns:
        op.add_column("item_drafts", sa.Column("mask_file_id", sa.String(length=48), nullable=True))
    if "catalog_file_id" not in columns:
        op.add_column("item_drafts", sa.Column("catalog_file_id", sa.String(length=48), nullable=True))
    if "catalog_processing_status" not in columns:
        op.add_column(
            "item_drafts",
            sa.Column("catalog_processing_status", sa.String(length=60), nullable=False, server_default="not_requested"),
        )
        op.alter_column("item_drafts", "catalog_processing_status", server_default=None)
    if "catalog_error_message" not in columns:
        op.add_column("item_drafts", sa.Column("catalog_error_message", sa.Text(), nullable=True))
    if "ml_result_json" not in columns:
        op.add_column("item_drafts", sa.Column("ml_result_json", sa.JSON(), nullable=True))
    if "started_at" not in columns:
        op.add_column("item_drafts", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    if "finished_at" not in columns:
        op.add_column("item_drafts", sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True))
    if "fk_item_drafts_mask_file_id" not in foreign_keys:
        op.create_foreign_key("fk_item_drafts_mask_file_id", "item_drafts", "files", ["mask_file_id"], ["id"])
    if "fk_item_drafts_catalog_file_id" not in foreign_keys:
        op.create_foreign_key("fk_item_drafts_catalog_file_id", "item_drafts", "files", ["catalog_file_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_item_drafts_catalog_file_id", "item_drafts", type_="foreignkey")
    op.drop_constraint("fk_item_drafts_mask_file_id", "item_drafts", type_="foreignkey")
    op.drop_column("item_drafts", "finished_at")
    op.drop_column("item_drafts", "started_at")
    op.drop_column("item_drafts", "ml_result_json")
    op.drop_column("item_drafts", "catalog_error_message")
    op.drop_column("item_drafts", "catalog_processing_status")
    op.drop_column("item_drafts", "catalog_file_id")
    op.drop_column("item_drafts", "mask_file_id")
