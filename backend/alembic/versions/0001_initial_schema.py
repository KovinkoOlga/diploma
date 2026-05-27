"""initial wardrobe schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-03
"""

from alembic import op

from app.db.metadata import (
    brands,
    categories,
    colors,
    file_variants,
    files,
    item_colors,
    item_drafts,
    item_seasons,
    item_statuses,
    item_styles,
    outfits,
    outfit_items,
    outfit_seasons,
    seasons,
    styles,
    subcategories,
    users,
    wardrobe_catalogs,
    wardrobe_items,
    wardrobe_item_templates,
)
from app.modules.wardrobe.colors import SYSTEM_COLOR_CATALOG


revision = "0001_initial_schema"
down_revision = None
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

TEMPLATES = [
    ("template_1", "Белая рубашка", "tops", "Рубашки", "", ["white_pure"], ["весна", "лето", "осень"], ["office", "classic"], 10),
    ("template_2", "Черные джинсы", "bottoms", "Джинсы", "", ["black_pure"], ["осень", "зима", "весна"], ["casual"], 20),
    ("template_3", "Бежевый тренч", "outerwear", "Тренчи", "", ["beige_neutral"], ["весна", "осень"], ["classic", "office"], 30),
    ("template_4", "Белые кроссовки", "shoes", "Кроссовки", "", ["white_pure"], ["весна", "лето", "осень"], ["casual", "sport"], 40),
    ("template_5", "Черное платье", "dresses", "Платья", "", ["black_pure"], ["лето", "осень"], ["evening", "classic"], 50),
    ("template_6", "Кожаная сумка", "accessories", "Кросс-боди", "", ["black_pure"], ["весна", "лето", "осень", "зима"], ["classic"], 60),
    ("template_7", "Спортивные легинсы", "bottoms", "Брюки", "", ["black_pure"], ["весна", "лето", "осень", "зима"], ["sport"], 70),
    ("template_8", "Шерстяной шарф", "accessories", "Шарфы", "", ["gray_neutral"], ["осень", "зима"], ["warm", "classic"], 80),
]


# Keep this revision bounded to the original base schema.
# Newer tables must be introduced by their own migrations instead of
# leaking in through the current application metadata.
INITIAL_TABLES = [
    files,
    users,
    file_variants,
    wardrobe_catalogs,
    categories,
    subcategories,
    colors,
    brands,
    seasons,
    styles,
    item_statuses,
    wardrobe_items,
    item_colors,
    item_seasons,
    item_styles,
    outfits,
    outfit_seasons,
    outfit_items,
    wardrobe_item_templates,
    item_drafts,
]


def upgrade() -> None:
    bind = op.get_bind()
    for table in INITIAL_TABLES:
        table.create(bind, checkfirst=True)

    op.bulk_insert(
        categories,
        [{"id": item[0], "name": item[1], "icon_key": item[2], "sort_order": item[3]} for item in CATEGORIES],
    )
    op.bulk_insert(
        subcategories,
        [
            {
                "id": f"system_{category_id}_{index}",
                "category_id": category_id,
                "user_id": None,
                "name": name,
                "normalized_name": _norm(name),
                "is_system": True,
            }
            for category_id, _, _, _, names in CATEGORIES
            for index, name in enumerate(names, start=1)
        ],
    )
    op.bulk_insert(
        item_statuses,
        [
            {"id": "status_active", "code": "active", "name": "Активна", "sort_order": 10},
            {"id": "status_archived", "code": "archived", "name": "В архиве", "sort_order": 20},
            {"id": "status_requires_repair", "code": "requires_repair", "name": "Требует ремонта", "sort_order": 30},
            {"id": "status_given_away", "code": "given_away", "name": "Отдана / продана", "sort_order": 40},
        ],
    )
    op.bulk_insert(
        seasons,
        [
            {"id": "season_spring", "name": "весна", "sort_order": 10},
            {"id": "season_summer", "name": "лето", "sort_order": 20},
            {"id": "season_autumn", "name": "осень", "sort_order": 30},
            {"id": "season_winter", "name": "зима", "sort_order": 40},
        ],
    )
    op.bulk_insert(colors, SYSTEM_COLOR_CATALOG)
    op.bulk_insert(
        styles,
        [
            {"id": f"style_{name}", "user_id": None, "name": name, "normalized_name": _norm(name), "is_system": True}
            for name in ["casual", "office", "sport", "classic", "warm", "evening", "home"]
        ],
    )
    op.bulk_insert(
        wardrobe_item_templates,
        [
            {
                "id": template_id,
                "name": name,
                "category_id": category_id,
                "subcategory_name": subcategory,
                "brand": brand,
                "color_ids_json": color_values,
                "seasons_json": season_values,
                "styles_json": style_values,
                "sort_order": sort_order,
            }
            for (
                template_id,
                name,
                category_id,
                subcategory,
                brand,
                color_values,
                season_values,
                style_values,
                sort_order,
            ) in TEMPLATES
        ],
    )


def downgrade() -> None:
    bind = op.get_bind()
    for table in reversed(INITIAL_TABLES):
        table.drop(bind, checkfirst=True)
