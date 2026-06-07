"""remove base templates and catalog enhancement draft fields

Revision ID: 0014_drop_catalog_template_flow
Revises: 0013_email_code_auth
Create Date: 2026-06-07
"""

from alembic import op
import sqlalchemy as sa


revision = "0014_drop_catalog_template_flow"
down_revision = "0013_email_code_auth"
branch_labels = None
depends_on = None


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _foreign_key_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {foreign_key["name"] for foreign_key in inspector.get_foreign_keys(table_name) if foreign_key.get("name")}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("item_drafts"):
        columns = _column_names(inspector, "item_drafts")
        foreign_keys = _foreign_key_names(inspector, "item_drafts")

        if "fk_item_drafts_catalog_file_id" in foreign_keys:
            op.drop_constraint("fk_item_drafts_catalog_file_id", "item_drafts", type_="foreignkey")

        with op.batch_alter_table("item_drafts") as batch_op:
            if "catalog_file_id" in columns:
                batch_op.drop_column("catalog_file_id")
            if "catalog_processing_status" in columns:
                batch_op.drop_column("catalog_processing_status")
            if "catalog_error_message" in columns:
                batch_op.drop_column("catalog_error_message")

    if inspector.has_table("wardrobe_item_templates"):
        op.drop_table("wardrobe_item_templates")


def downgrade() -> None:
    raise NotImplementedError("This migration is forward-only.")
