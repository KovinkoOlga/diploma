"""add mask source fields to wardrobe items

Revision ID: 0015_item_mask_fields
Revises: 0014_drop_catalog_template_flow
Create Date: 2026-06-07
"""

from alembic import op
import sqlalchemy as sa


revision = "0015_item_mask_fields"
down_revision = "0014_drop_catalog_template_flow"
branch_labels = None
depends_on = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _foreign_key_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {foreign_key["name"] for foreign_key in inspector.get_foreign_keys(table_name) if foreign_key.get("name")}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("wardrobe_items"):
        return

    columns = _column_names(inspector, "wardrobe_items")
    foreign_keys = _foreign_key_names(inspector, "wardrobe_items")

    with op.batch_alter_table("wardrobe_items") as batch_op:
        if "original_file_id" not in columns:
            batch_op.add_column(sa.Column("original_file_id", sa.String(length=48), nullable=True))
        if "editor_file_id" not in columns:
            batch_op.add_column(sa.Column("editor_file_id", sa.String(length=48), nullable=True))
        if "mask_file_id" not in columns:
            batch_op.add_column(sa.Column("mask_file_id", sa.String(length=48), nullable=True))
        if "processed_file_id" not in columns:
            batch_op.add_column(sa.Column("processed_file_id", sa.String(length=48), nullable=True))

    if "fk_wardrobe_items_original_file_id" not in foreign_keys:
        op.create_foreign_key(
            "fk_wardrobe_items_original_file_id",
            "wardrobe_items",
            "files",
            ["original_file_id"],
            ["id"],
        )
    if "fk_wardrobe_items_editor_file_id" not in foreign_keys:
        op.create_foreign_key(
            "fk_wardrobe_items_editor_file_id",
            "wardrobe_items",
            "files",
            ["editor_file_id"],
            ["id"],
        )
    if "fk_wardrobe_items_mask_file_id" not in foreign_keys:
        op.create_foreign_key(
            "fk_wardrobe_items_mask_file_id",
            "wardrobe_items",
            "files",
            ["mask_file_id"],
            ["id"],
        )
    if "fk_wardrobe_items_processed_file_id" not in foreign_keys:
        op.create_foreign_key(
            "fk_wardrobe_items_processed_file_id",
            "wardrobe_items",
            "files",
            ["processed_file_id"],
            ["id"],
        )


def downgrade() -> None:
    op.drop_constraint("fk_wardrobe_items_processed_file_id", "wardrobe_items", type_="foreignkey")
    op.drop_constraint("fk_wardrobe_items_mask_file_id", "wardrobe_items", type_="foreignkey")
    op.drop_constraint("fk_wardrobe_items_editor_file_id", "wardrobe_items", type_="foreignkey")
    op.drop_constraint("fk_wardrobe_items_original_file_id", "wardrobe_items", type_="foreignkey")
    with op.batch_alter_table("wardrobe_items") as batch_op:
        batch_op.drop_column("processed_file_id")
        batch_op.drop_column("mask_file_id")
        batch_op.drop_column("editor_file_id")
        batch_op.drop_column("original_file_id")
