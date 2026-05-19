"""update wardrobe category names

Revision ID: 0004_update_wardrobe_categories
Revises: 0003_item_draft_ml_pipeline
Create Date: 2026-05-19
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_update_wardrobe_categories"
down_revision = "0003_item_draft_ml_pipeline"
branch_labels = None
depends_on = None


def _norm(value: str) -> str:
    return value.strip().lower().replace("ё", "е")


CATEGORIES = [
    ("tops", "Верх", "tops", 10, ["Футболки", "Рубашки", "Свитеры", "Худи", "Топы"]),
    ("bottoms", "Низ", "bottoms", 20, ["Джинсы", "Брюки", "Юбки", "Шорты"]),
    ("dresses", "Слитное", "dresses", 30, ["Платья", "Комбинезоны"]),
    ("outerwear", "Верхняя одежда", "outerwear", 40, ["Пальто", "Куртки", "Тренчи", "Жилеты"]),
    ("shoes", "Обувь", "shoes", 50, ["Кроссовки", "Ботинки", "Туфли", "Сандалии"]),
    (
        "accessories",
        "Сумки и аксессуары",
        "accessories",
        60,
        ["Шоперы", "Кросс-боди", "Рюкзаки", "Клатчи", "Шарфы", "Украшения", "Ремни", "Головные уборы"],
    ),
]


def upgrade() -> None:
    bind = op.get_bind()

    for category_id, name, icon_key, sort_order, _ in CATEGORIES:
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
            {"id": category_id, "name": name, "icon_key": icon_key, "sort_order": sort_order},
        )

    bind.execute(sa.text("UPDATE wardrobe_items SET category_id = 'accessories' WHERE category_id = 'bags'"))
    bind.execute(sa.text("UPDATE wardrobe_item_templates SET category_id = 'accessories' WHERE category_id = 'bags'"))
    bind.execute(
        sa.text(
            """
            DELETE FROM subcategories bags
            USING subcategories accessories
            WHERE bags.category_id = 'bags'
              AND accessories.category_id = 'accessories'
              AND bags.user_id IS NOT DISTINCT FROM accessories.user_id
              AND bags.normalized_name = accessories.normalized_name
            """
        )
    )
    bind.execute(sa.text("UPDATE subcategories SET category_id = 'accessories' WHERE category_id = 'bags'"))
    bind.execute(sa.text("DELETE FROM categories WHERE id = 'bags'"))

    for category_id, _, _, _, subcategory_names in CATEGORIES:
        for index, name in enumerate(subcategory_names, start=1):
            bind.execute(
                sa.text(
                    """
                    INSERT INTO subcategories (id, category_id, user_id, name, normalized_name, is_system)
                    VALUES (:id, :category_id, NULL, :name, :normalized_name, TRUE)
                    ON CONFLICT DO NOTHING
                    """
                ),
                {
                    "id": f"system_{category_id}_{index}",
                    "category_id": category_id,
                    "name": name,
                    "normalized_name": _norm(name),
                },
            )


def downgrade() -> None:
    bind = op.get_bind()

    bind.execute(
        sa.text(
            """
            INSERT INTO categories (id, name, icon_key, sort_order)
            VALUES ('bags', 'Сумки', 'bag-handle-outline', 60)
            ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name,
                icon_key = EXCLUDED.icon_key,
                sort_order = EXCLUDED.sort_order
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE categories
            SET name = 'Аксессуары',
                icon_key = 'watch-outline',
                sort_order = 70
            WHERE id = 'accessories'
            """
        )
    )
    bind.execute(sa.text("UPDATE categories SET name = 'Платья / комбинезоны' WHERE id = 'dresses'"))
    bind.execute(sa.text("UPDATE categories SET icon_key = 'swap-vertical-outline' WHERE id = 'bottoms'"))
    bind.execute(sa.text("UPDATE wardrobe_item_templates SET category_id = 'bags' WHERE id = 'template_6'"))
    bind.execute(
        sa.text(
            """
            UPDATE subcategories
            SET category_id = 'bags'
            WHERE category_id = 'accessories'
              AND normalized_name IN ('шоперы', 'кросс-боди', 'рюкзаки', 'клатчи')
            """
        )
    )
