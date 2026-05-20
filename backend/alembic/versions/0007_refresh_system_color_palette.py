"""refresh system color palette

Revision ID: 0007_refresh_palette
Revises: 0006_normalize_item_colors
Create Date: 2026-05-21
"""

from __future__ import annotations

import json

import sqlalchemy as sa
from alembic import op

from app.modules.wardrobe.colors import SYSTEM_COLOR_CATALOG, map_legacy_color_names


revision = "0007_refresh_palette"
down_revision = "0006_normalize_item_colors"
branch_labels = None
depends_on = None


def _normalize_json_string_list(raw_value) -> list[str]:
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

    item_color_rows = bind.execute(
        sa.text(
            """
            SELECT id, item_id, color_id, position, coverage_percent, source, confidence
            FROM item_colors
            ORDER BY item_id, COALESCE(position, 0), id
            """
        )
    ).mappings().all()

    template_rows = bind.execute(
        sa.text("SELECT id, color_ids_json FROM wardrobe_item_templates ORDER BY id")
    ).mappings().all()

    remapped_item_colors: list[dict[str, object | None]] = []
    next_position_by_item: dict[str, int] = {}
    seen_color_ids_by_item: dict[str, set[str]] = {}
    for row in item_color_rows:
        mapped_ids = map_legacy_color_names([row["color_id"]])
        if not mapped_ids:
            continue
        mapped_color_id = mapped_ids[0]
        seen_for_item = seen_color_ids_by_item.setdefault(row["item_id"], set())
        if mapped_color_id in seen_for_item:
            continue
        seen_for_item.add(mapped_color_id)
        position = next_position_by_item.get(row["item_id"], 0)
        next_position_by_item[row["item_id"]] = position + 1
        remapped_item_colors.append(
            {
                "id": row["id"],
                "item_id": row["item_id"],
                "color_id": mapped_color_id,
                "position": position,
                "coverage_percent": row["coverage_percent"],
                "source": row["source"],
                "confidence": row["confidence"],
            }
        )

    template_update = sa.text(
        "UPDATE wardrobe_item_templates SET color_ids_json = :color_ids_json WHERE id = :id"
    ).bindparams(sa.bindparam("color_ids_json", type_=sa.JSON()))
    for row in template_rows:
        bind.execute(
            template_update,
            {
                "id": row["id"],
                "color_ids_json": map_legacy_color_names(_normalize_json_string_list(row["color_ids_json"])),
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

    if remapped_item_colors:
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
            remapped_item_colors,
        )


def downgrade() -> None:
    raise NotImplementedError("Downgrade is not supported for 0007_refresh_system_color_palette")
