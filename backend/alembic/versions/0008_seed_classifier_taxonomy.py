"""seed classifier taxonomy

Revision ID: 0008_seed_classifier_taxonomy
Revises: 0007_refresh_palette
Create Date: 2026-05-21
"""

from alembic import op
import sqlalchemy as sa

from app.modules.wardrobe.taxonomy import SYSTEM_CATEGORIES, SYSTEM_SUBCATEGORIES


revision = "0008_seed_classifier_taxonomy"
down_revision = "0007_refresh_palette"
branch_labels = None
depends_on = None


CATEGORY_REMAP = {
    "dresses": "one_piece",
    "accessories": "bags_accessories",
    "bags": "bags_accessories",
}

TEMP_CATEGORY_NAMES = {
    "one_piece": "__one_piece__",
    "bags_accessories": "__bags_accessories__",
}


def _ensure_category_stub(bind, category_id: str, icon_key: str, sort_order: int) -> None:
    bind.execute(
        sa.text(
            """
            INSERT INTO categories (id, name, icon_key, sort_order)
            VALUES (:id, :name, :icon_key, :sort_order)
            ON CONFLICT (id) DO NOTHING
            """
        ),
        {
            "id": category_id,
            "name": TEMP_CATEGORY_NAMES[category_id],
            "icon_key": icon_key,
            "sort_order": sort_order,
        },
    )


def _remap_category_references(bind, old_id: str, new_id: str) -> None:
    bind.execute(sa.text("UPDATE wardrobe_items SET category_id = :new_id WHERE category_id = :old_id"), {"old_id": old_id, "new_id": new_id})
    bind.execute(
        sa.text("UPDATE wardrobe_item_templates SET category_id = :new_id WHERE category_id = :old_id"),
        {"old_id": old_id, "new_id": new_id},
    )
    bind.execute(
        sa.text(
            """
            UPDATE item_drafts
            SET suggested_payload_json = jsonb_set(
                COALESCE(suggested_payload_json::jsonb, '{}'::jsonb),
                '{categoryId}',
                to_jsonb(CAST(:new_id AS text)),
                true
            )
            WHERE suggested_payload_json IS NOT NULL
              AND suggested_payload_json->>'categoryId' = :old_id
            """
        ),
        {"old_id": old_id, "new_id": new_id},
    )
    bind.execute(
        sa.text(
            """
            DELETE FROM subcategories source
            USING subcategories target
            WHERE source.category_id = :old_id
              AND target.category_id = :new_id
              AND source.user_id IS NOT DISTINCT FROM target.user_id
              AND source.normalized_name = target.normalized_name
            """
        ),
        {"old_id": old_id, "new_id": new_id},
    )
    bind.execute(
        sa.text("UPDATE subcategories SET category_id = :new_id WHERE category_id = :old_id"),
        {"old_id": old_id, "new_id": new_id},
    )


def upgrade() -> None:
    bind = op.get_bind()

    for category in SYSTEM_CATEGORIES:
        if category["id"] in TEMP_CATEGORY_NAMES:
            _ensure_category_stub(bind, category["id"], category["icon_key"], category["sort_order"])

    for old_id, new_id in CATEGORY_REMAP.items():
        _remap_category_references(bind, old_id, new_id)

    bind.execute(sa.text("DELETE FROM categories WHERE id IN ('dresses', 'accessories', 'bags')"))

    for category in SYSTEM_CATEGORIES:
        bind.execute(
            sa.text(
                """
                INSERT INTO categories (id, name, icon_key, sort_order)
                VALUES (:id, :name, :icon_key, :sort_order)
                ON CONFLICT (id) DO UPDATE
                SET name = EXCLUDED.name,
                    icon_key = EXCLUDED.icon_key,
                    sort_order = EXCLUDED.sort_order
                """
            ),
            category,
        )

    for subcategory in SYSTEM_SUBCATEGORIES:
        bind.execute(
            sa.text(
                """
                INSERT INTO subcategories (id, category_id, user_id, name, normalized_name, is_system)
                VALUES (:id, :category_id, NULL, :name, :normalized_name, TRUE)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            subcategory,
        )
        bind.execute(
            sa.text(
                """
                UPDATE subcategories
                SET category_id = :category_id,
                    user_id = NULL,
                    name = :name,
                    normalized_name = :normalized_name,
                    is_system = TRUE
                WHERE id = :id
                """
            ),
            subcategory,
        )


def downgrade() -> None:
    pass
