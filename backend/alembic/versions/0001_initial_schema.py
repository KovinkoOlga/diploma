"""initial wardrobe schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-03
"""

from alembic import op

from app.db.metadata import (
    categories,
    colors,
    item_statuses,
    metadata,
    seasons,
    sizes,
    styles,
    subcategories,
    wardrobe_item_templates,
)


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def _norm(value: str) -> str:
    return value.strip().lower().replace("ё", "е")


CATEGORIES = [
    ("tops", "Верх", "shirt-outline", 10, ["Футболки", "Рубашки", "Свитеры", "Худи", "Топы"]),
    ("bottoms", "Низ", "swap-vertical-outline", 20, ["Джинсы", "Брюки", "Юбки", "Шорты"]),
    ("dresses", "Платья / комбинезоны", "woman-outline", 30, ["Платья", "Комбинезоны"]),
    ("outerwear", "Верхняя одежда", "snow-outline", 40, ["Пальто", "Куртки", "Тренчи", "Жилеты"]),
    ("shoes", "Обувь", "footsteps-outline", 50, ["Кроссовки", "Ботинки", "Туфли", "Сандалии"]),
    ("bags", "Сумки", "bag-handle-outline", 60, ["Шоперы", "Кросс-боди", "Рюкзаки", "Клатчи"]),
    ("accessories", "Аксессуары", "watch-outline", 70, ["Шарфы", "Украшения", "Ремни", "Головные уборы"]),
]

TEMPLATES = [
    ("template_1", "Белая рубашка", "tops", "Рубашки", "", "", "хлопок", ["белый"], ["весна", "лето", "осень"], ["office", "classic"], 10),
    ("template_2", "Черные джинсы", "bottoms", "Джинсы", "", "", "деним", ["черный"], ["осень", "зима", "весна"], ["casual"], 20),
    ("template_3", "Бежевый тренч", "outerwear", "Тренчи", "", "", "габардин", ["бежевый"], ["весна", "осень"], ["classic", "office"], 30),
    ("template_4", "Белые кроссовки", "shoes", "Кроссовки", "", "", "кожа", ["белый"], ["весна", "лето", "осень"], ["casual", "sport"], 40),
    ("template_5", "Черное платье", "dresses", "Платья", "", "", "вискоза", ["черный"], ["лето", "осень"], ["evening", "classic"], 50),
    ("template_6", "Кожаная сумка", "bags", "Кросс-боди", "", "", "кожа", ["черный"], ["весна", "лето", "осень", "зима"], ["classic"], 60),
    ("template_7", "Спортивные легинсы", "bottoms", "Брюки", "", "", "эластан", ["черный"], ["весна", "лето", "осень", "зима"], ["sport"], 70),
    ("template_8", "Шерстяной шарф", "accessories", "Шарфы", "", "", "шерсть", ["серый"], ["осень", "зима"], ["warm", "classic"], 80),
]


def upgrade() -> None:
    bind = op.get_bind()
    metadata.create_all(bind)

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
    op.bulk_insert(
        colors,
        [
            {"id": f"color_{_norm(name)}", "name": name, "parent_color_id": None, "hex": hex_value}
            for name, hex_value in [
                ("белый", "#ffffff"),
                ("молочный", "#f5f0e6"),
                ("черный", "#111111"),
                ("серый", "#808080"),
                ("графит", "#41424c"),
                ("бежевый", "#d8c3a5"),
                ("синий", "#2457a6"),
                ("зеленый", "#2f7d46"),
                ("розовый", "#e7a0b8"),
            ]
        ],
    )
    op.bulk_insert(
        sizes,
        [{"id": f"size_{index}", "name": name, "category_id": None} for index, name in enumerate(["XS", "S", "M", "L", "XL", "38", "39", "40", "one size", "28", "29"], start=1)],
    )
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
                "size_name": size_name,
                "material": material,
                "colors_json": color_values,
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
                size_name,
                material,
                color_values,
                season_values,
                style_values,
                sort_order,
            ) in TEMPLATES
        ],
    )


def downgrade() -> None:
    bind = op.get_bind()
    metadata.drop_all(bind)

