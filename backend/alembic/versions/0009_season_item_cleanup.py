"""merge seasons and drop item size/material

Revision ID: 0009_season_item_cleanup
Revises: 0008_seed_classifier_taxonomy
Create Date: 2026-05-22
"""

from alembic import op
import sqlalchemy as sa


revision = "0009_season_item_cleanup"
down_revision = "0008_seed_classifier_taxonomy"
branch_labels = None
depends_on = None


SEASON_REMAP = {
    "весна": "осень/весна",
    "осень": "осень/весна",
}
FINAL_SEASONS = [
    ("лето", 10),
    ("зима", 20),
    ("осень/весна", 30),
]


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _normalize_season_values(values: list[str] | None) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for name in values or []:
        value = SEASON_REMAP.get(str(name or "").strip(), str(name or "").strip())
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)

    order_index = {name: index for index, (name, _) in enumerate(FINAL_SEASONS)}
    normalized.sort(key=lambda name: order_index.get(name, len(order_index)))
    return normalized


def _normalize_draft_payload(payload: dict | None) -> dict | None:
    if not isinstance(payload, dict):
        return payload
    normalized = dict(payload)
    normalized.pop("size", None)
    normalized.pop("material", None)
    if "seasons" in normalized:
        normalized["seasons"] = _normalize_season_values(normalized.get("seasons"))
    if "season" in normalized:
        normalized["season"] = _normalize_season_values(normalized.get("season"))
    return normalized


def _normalize_item_attributes(attributes: dict | None) -> dict | None:
    if not isinstance(attributes, dict):
        return attributes
    normalized = dict(attributes)
    normalized.pop("material", None)
    return normalized


def _normalize_template_row(bind) -> None:
    rows = bind.execute(sa.text("SELECT id, seasons_json FROM wardrobe_item_templates")).mappings().all()
    update_stmt = sa.text("UPDATE wardrobe_item_templates SET seasons_json = :seasons_json WHERE id = :id").bindparams(
        sa.bindparam("seasons_json", type_=sa.JSON())
    )
    for row in rows:
        bind.execute(update_stmt, {"id": row["id"], "seasons_json": _normalize_season_values(row["seasons_json"])})


def _normalize_draft_rows(bind) -> None:
    rows = bind.execute(sa.text("SELECT id, suggested_payload_json FROM item_drafts")).mappings().all()
    update_stmt = sa.text("UPDATE item_drafts SET suggested_payload_json = :payload WHERE id = :id").bindparams(
        sa.bindparam("payload", type_=sa.JSON())
    )
    for row in rows:
        payload = _normalize_draft_payload(row["suggested_payload_json"])
        bind.execute(update_stmt, {"id": row["id"], "payload": payload})


def _normalize_item_attributes_rows(bind) -> None:
    rows = bind.execute(sa.text("SELECT id, attributes_json FROM wardrobe_items")).mappings().all()
    update_stmt = sa.text("UPDATE wardrobe_items SET attributes_json = :attributes WHERE id = :id").bindparams(
        sa.bindparam("attributes", type_=sa.JSON())
    )
    for row in rows:
        attributes = _normalize_item_attributes(row["attributes_json"])
        bind.execute(update_stmt, {"id": row["id"], "attributes": attributes})


def _merge_season_links(bind, table_name: str, owner_column: str, old_ids: list[str], new_id: str) -> None:
    if not old_ids:
        return

    insert_stmt = sa.text(
        f"""
        INSERT INTO {table_name} (id, {owner_column}, season_id)
        SELECT SUBSTR(:prefix || md5(source.{owner_column} || ':' || :season_id), 1, 48), source.{owner_column}, :season_id
        FROM {table_name} AS source
        WHERE source.season_id IN :old_ids
          AND NOT EXISTS (
              SELECT 1
              FROM {table_name} AS target
              WHERE target.{owner_column} = source.{owner_column}
                AND target.season_id = :season_id
          )
        GROUP BY source.{owner_column}
        """
    ).bindparams(sa.bindparam("old_ids", expanding=True))
    bind.execute(
        insert_stmt,
        {
            "prefix": f"{table_name[:-1]}_",
            "season_id": new_id,
            "old_ids": old_ids,
        },
    )

    delete_stmt = sa.text(f"DELETE FROM {table_name} WHERE season_id IN :old_ids").bindparams(
        sa.bindparam("old_ids", expanding=True)
    )
    bind.execute(delete_stmt, {"old_ids": old_ids})


def _normalize_seasons(bind) -> None:
    rows = bind.execute(sa.text("SELECT id, name FROM seasons")).mappings().all()
    id_by_name = {row["name"]: row["id"] for row in rows}

    transitional_id = id_by_name.get("осень/весна")
    if transitional_id is None:
        transitional_id = "season_transitional"
        bind.execute(
            sa.text(
                """
                INSERT INTO seasons (id, name, sort_order)
                VALUES (:id, :name, :sort_order)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {"id": transitional_id, "name": "осень/весна", "sort_order": 30},
        )
        bind.execute(
            sa.text("UPDATE seasons SET name = :name, sort_order = :sort_order WHERE id = :id"),
            {"id": transitional_id, "name": "осень/весна", "sort_order": 30},
        )

    old_transition_ids = [season_id for name, season_id in id_by_name.items() if name in {"весна", "осень"}]
    _merge_season_links(bind, "item_seasons", "item_id", old_transition_ids, transitional_id)
    _merge_season_links(bind, "outfit_seasons", "outfit_id", old_transition_ids, transitional_id)

    if old_transition_ids:
        delete_stmt = sa.text("DELETE FROM seasons WHERE id IN :ids").bindparams(sa.bindparam("ids", expanding=True))
        bind.execute(delete_stmt, {"ids": old_transition_ids})

    for name, sort_order in FINAL_SEASONS:
        bind.execute(
            sa.text("UPDATE seasons SET sort_order = :sort_order WHERE name = :name"),
            {"name": name, "sort_order": sort_order},
        )

    bind.execute(
        sa.text("DELETE FROM seasons WHERE name NOT IN ('лето', 'зима', 'осень/весна')"),
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("seasons"):
        _normalize_seasons(bind)

    if inspector.has_table("wardrobe_item_templates"):
        _normalize_template_row(bind)

    if inspector.has_table("item_drafts"):
        _normalize_draft_rows(bind)

    if inspector.has_table("wardrobe_items"):
        _normalize_item_attributes_rows(bind)

    if inspector.has_table("wardrobe_items") and "size_id" in _column_names(inspector, "wardrobe_items"):
        with op.batch_alter_table("wardrobe_items") as batch_op:
            batch_op.drop_column("size_id")

    if inspector.has_table("wardrobe_item_templates"):
        template_columns = _column_names(inspector, "wardrobe_item_templates")
        with op.batch_alter_table("wardrobe_item_templates") as batch_op:
            if "size_name" in template_columns:
                batch_op.drop_column("size_name")
            if "material" in template_columns:
                batch_op.drop_column("material")

    if inspector.has_table("sizes"):
        op.drop_table("sizes")


def downgrade() -> None:
    raise NotImplementedError("Downgrade is not supported for this migration")
