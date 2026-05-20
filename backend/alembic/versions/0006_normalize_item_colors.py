"""normalize item colors

Revision ID: 0006_normalize_item_colors
Revises: 0005_outfit_cover_editor_state
Create Date: 2026-05-20
"""

from __future__ import annotations

import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

from app.modules.wardrobe.colors import SYSTEM_COLOR_CATALOG, map_legacy_color_names


revision = "0006_normalize_item_colors"
down_revision = "0005_outfit_cover_editor_state"
branch_labels = None
depends_on = None


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _normalize_legacy_template_colors(raw_value) -> list[str]:
    if raw_value is None:
        return []
    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
        except json.JSONDecodeError:
            return []
        raw_value = parsed
    if isinstance(raw_value, list):
        return [value for value in raw_value if isinstance(value, str)]
    return []


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _has_column(inspector, "colors", "kind"):
        op.add_column("colors", sa.Column("kind", sa.String(length=24), nullable=False, server_default="solid"))
    if not _has_column(inspector, "colors", "sort_order"):
        op.add_column("colors", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))

    if not _has_column(inspector, "item_colors", "position"):
        op.add_column("item_colors", sa.Column("position", sa.Integer(), nullable=False, server_default="0"))
    if not _has_column(inspector, "item_colors", "coverage_percent"):
        op.add_column("item_colors", sa.Column("coverage_percent", sa.Float(), nullable=True))
    if not _has_column(inspector, "item_colors", "source"):
        op.add_column("item_colors", sa.Column("source", sa.String(length=24), nullable=True))
    if not _has_column(inspector, "item_colors", "confidence"):
        op.add_column("item_colors", sa.Column("confidence", sa.Float(), nullable=True))

    inspector = inspect(bind)
    if not _has_column(inspector, "wardrobe_item_templates", "color_ids_json"):
        op.add_column(
            "wardrobe_item_templates",
            sa.Column("color_ids_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        )

    color_rows = bind.execute(sa.text("SELECT id, name FROM colors")).mappings().all()
    legacy_color_name_by_id = {row["id"]: row["name"] for row in color_rows}

    item_color_rows = bind.execute(
        sa.text(
            """
            SELECT ic.id, ic.item_id, ic.color_id, ic.position, ic.coverage_percent, ic.source, ic.confidence
            FROM item_colors ic
            ORDER BY ic.item_id, COALESCE(ic.position, 0), ic.id
            """
        )
    ).mappings().all()

    migrated_item_colors: list[dict] = []
    item_position_map: dict[str, int] = {}
    for row in item_color_rows:
        legacy_name = legacy_color_name_by_id.get(row["color_id"])
        mapped_ids = map_legacy_color_names([legacy_name] if legacy_name else [])
        if not mapped_ids:
            continue
        next_position = item_position_map.get(row["item_id"], 0)
        item_position_map[row["item_id"]] = next_position + 1
        migrated_item_colors.append(
            {
                "id": row["id"],
                "item_id": row["item_id"],
                "color_id": mapped_ids[0],
                "position": next_position,
                "coverage_percent": row.get("coverage_percent"),
                "source": row.get("source") or "manual",
                "confidence": row.get("confidence"),
            }
        )

    if _has_column(inspector, "wardrobe_item_templates", "colors_json"):
        template_update = sa.text(
            "UPDATE wardrobe_item_templates SET color_ids_json = :color_ids_json WHERE id = :id"
        ).bindparams(sa.bindparam("color_ids_json", type_=sa.JSON()))
        template_rows = bind.execute(sa.text("SELECT id, colors_json FROM wardrobe_item_templates")).mappings().all()
        for row in template_rows:
            bind.execute(
                template_update,
                {
                    "id": row["id"],
                    "color_ids_json": map_legacy_color_names(_normalize_legacy_template_colors(row.get("colors_json"))),
                },
            )

    bind.execute(sa.text("DELETE FROM item_colors"))
    bind.execute(sa.text("DELETE FROM colors"))
    op.bulk_insert(
        sa.table(
            "colors",
            sa.column("id", sa.String()),
            sa.column("name", sa.String()),
            sa.column("parent_color_id", sa.String()),
            sa.column("hex", sa.String()),
            sa.column("kind", sa.String()),
            sa.column("sort_order", sa.Integer()),
        ),
        SYSTEM_COLOR_CATALOG,
    )

    if migrated_item_colors:
        op.bulk_insert(
            sa.table(
                "item_colors",
                sa.column("id", sa.String()),
                sa.column("item_id", sa.String()),
                sa.column("color_id", sa.String()),
                sa.column("position", sa.Integer()),
                sa.column("coverage_percent", sa.Float()),
                sa.column("source", sa.String()),
                sa.column("confidence", sa.Float()),
            ),
            migrated_item_colors,
        )

    inspector = inspect(bind)
    if _has_column(inspector, "wardrobe_item_templates", "colors_json"):
        op.drop_column("wardrobe_item_templates", "colors_json")

    op.alter_column("colors", "kind", server_default=None)
    op.alter_column("colors", "sort_order", server_default=None)
    op.alter_column("item_colors", "position", server_default=None)
    op.alter_column("wardrobe_item_templates", "color_ids_json", server_default=None)


def downgrade() -> None:
    raise NotImplementedError("Downgrade is not supported for 0006_normalize_item_colors")
