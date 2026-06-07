"""passwordless email code auth

Revision ID: 0013_email_code_auth
Revises: 0012_item_draft_editor_file
Create Date: 2026-06-07
"""

from alembic import op
import sqlalchemy as sa


revision = "0013_email_code_auth"
down_revision = "0012_item_draft_editor_file"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    existing_tables = set(inspector.get_table_names())

    if "email_verified_at" not in user_columns:
        op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    if "backup_email" not in user_columns:
        op.add_column("users", sa.Column("backup_email", sa.String(length=255), nullable=True))
    if "backup_email_verified_at" not in user_columns:
        op.add_column("users", sa.Column("backup_email_verified_at", sa.DateTime(timezone=True), nullable=True))
    if "backup_email_added_at" not in user_columns:
        op.add_column("users", sa.Column("backup_email_added_at", sa.DateTime(timezone=True), nullable=True))

    op.execute(sa.text("UPDATE users SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP)"))
    op.alter_column("users", "email_verified_at", existing_type=sa.DateTime(timezone=True), nullable=False)

    if "password_hash" in user_columns:
        op.drop_column("users", "password_hash")

    if "email_verification_codes" not in existing_tables:
        op.create_table(
            "email_verification_codes",
            sa.Column("id", sa.String(length=48), primary_key=True),
            sa.Column("user_id", sa.String(length=48), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("purpose", sa.String(length=40), nullable=False),
            sa.Column("code_hash", sa.String(length=128), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("attempts_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("resend_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("next_resend_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("metadata_json", sa.JSON(), nullable=True),
        )

    index_names = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_confirmed_backup_email_unique" not in index_names:
        op.create_index(
            "ix_users_confirmed_backup_email_unique",
            "users",
            ["backup_email"],
            unique=True,
            postgresql_where=sa.text("backup_email IS NOT NULL AND backup_email_verified_at IS NOT NULL"),
        )

    code_indexes = set()
    if "email_verification_codes" in set(sa.inspect(bind).get_table_names()):
        code_indexes = {index["name"] for index in sa.inspect(bind).get_indexes("email_verification_codes")}
    if "ix_email_verification_codes_email_purpose_created_at" not in code_indexes:
        op.create_index(
            "ix_email_verification_codes_email_purpose_created_at",
            "email_verification_codes",
            ["email", "purpose", "created_at"],
        )
    if "ix_email_verification_codes_user_purpose_created_at" not in code_indexes:
        op.create_index(
            "ix_email_verification_codes_user_purpose_created_at",
            "email_verification_codes",
            ["user_id", "purpose", "created_at"],
        )
    if "ix_email_verification_codes_expires_at" not in code_indexes:
        op.create_index("ix_email_verification_codes_expires_at", "email_verification_codes", ["expires_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "email_verification_codes" in tables:
        op.drop_index("ix_email_verification_codes_expires_at", table_name="email_verification_codes")
        op.drop_index("ix_email_verification_codes_user_purpose_created_at", table_name="email_verification_codes")
        op.drop_index("ix_email_verification_codes_email_purpose_created_at", table_name="email_verification_codes")
        op.drop_table("email_verification_codes")

    indexes = {index["name"] for index in inspector.get_indexes("users")}
    if "ix_users_confirmed_backup_email_unique" in indexes:
        op.drop_index("ix_users_confirmed_backup_email_unique", table_name="users")

    columns = {column["name"] for column in inspector.get_columns("users")}
    if "backup_email_added_at" in columns:
        op.drop_column("users", "backup_email_added_at")
    if "backup_email_verified_at" in columns:
        op.drop_column("users", "backup_email_verified_at")
    if "backup_email" in columns:
        op.drop_column("users", "backup_email")
    if "email_verified_at" in columns:
        op.drop_column("users", "email_verified_at")
    if "password_hash" not in columns:
        op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
