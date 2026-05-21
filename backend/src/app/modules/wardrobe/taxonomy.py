from __future__ import annotations

import re
import unicodedata


CATEGORY_DEFINITIONS = [
    {"raw_label": "верх", "id": "tops", "title": "Верх", "icon_key": "tops", "sort_order": 10},
    {"raw_label": "верхняя одежда", "id": "outerwear", "title": "Верхняя одежда", "icon_key": "outerwear", "sort_order": 20},
    {"raw_label": "низ", "id": "bottoms", "title": "Низ", "icon_key": "bottoms", "sort_order": 30},
    {"raw_label": "обувь", "id": "shoes", "title": "Обувь", "icon_key": "shoes", "sort_order": 40},
    {"raw_label": "слитное", "id": "one_piece", "title": "Слитное", "icon_key": "dresses", "sort_order": 50},
    {
        "raw_label": "сумки и аксессуары",
        "id": "bags_accessories",
        "title": "Сумки и аксессуары",
        "icon_key": "accessories",
        "sort_order": 60,
    },
]

# Synced with ml-vision-service/models/classifier_artifacts/taxonomy.csv.
SYSTEM_TAXONOMY_ROWS = [
    ("верх", "Блузка"),
    ("верх", "Боди"),
    ("верх", "Водолазка"),
    ("верх", "Джемпер"),
    ("верх", "Жилет"),
    ("верх", "Кардиган"),
    ("верх", "Кофта"),
    ("верх", "Лонгслив"),
    ("верх", "Майка"),
    ("верх", "Пиджак"),
    ("верх", "Поло"),
    ("верх", "Рубашка"),
    ("верх", "Свитер"),
    ("верх", "Топ"),
    ("верх", "Футболка"),
    ("верхняя одежда", "Верхний жилет"),
    ("верхняя одежда", "Джинсовка"),
    ("верхняя одежда", "Дублёнка"),
    ("верхняя одежда", "Кожанка_косуха"),
    ("верхняя одежда", "Комбинезоны"),
    ("верхняя одежда", "Куртка"),
    ("верхняя одежда", "Пальто"),
    ("верхняя одежда", "Тренч_плащ"),
    ("верхняя одежда", "Шуба"),
    ("низ", "Брюки"),
    ("низ", "Джинсы"),
    ("низ", "Легинсы_тайтсы"),
    ("низ", "Спортивные штаны"),
    ("низ", "Шорты"),
    ("низ", "Юбка"),
    ("обувь", "Босоножки на каблуке"),
    ("обувь", "Ботильоны"),
    ("обувь", "Ботинки"),
    ("обувь", "Кроссовки _ кеды"),
    ("обувь", "Плоская обувь"),
    ("обувь", "Сандалии"),
    ("обувь", "Сапоги"),
    ("обувь", "Тапки_шлёпки"),
    ("обувь", "Туфли на каблуке"),
    ("слитное", "Комбинезон"),
    ("слитное", "Платье"),
    ("слитное", "Сарафан"),
    ("сумки и аксессуары", "Аксессуары для волос"),
    ("сумки и аксессуары", "Головной убор"),
    ("сумки и аксессуары", "Очки"),
    ("сумки и аксессуары", "Перчатки"),
    ("сумки и аксессуары", "Ремень"),
    ("сумки и аксессуары", "Сумка_рюкзак"),
    ("сумки и аксессуары", "Украшения"),
    ("сумки и аксессуары", "Шарф"),
]

CYRILLIC_TRANSLITERATION = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "e",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "i",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "kh",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "shch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}

CATEGORY_BY_RAW_LABEL = {entry["raw_label"]: entry for entry in CATEGORY_DEFINITIONS}


def normalize_nfc(value: str) -> str:
    return unicodedata.normalize("NFC", str(value or "")).strip()


def format_subcategory_display_name(value: str) -> str:
    normalized = normalize_nfc(value)
    normalized = re.sub(r"\s*_\s*", " / ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def normalize_name(value: str) -> str:
    normalized = normalize_nfc(value)
    normalized = re.sub(r"\s*[_/\\-]+\s*", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.lower().strip()


def slugify_subcategory(value: str) -> str:
    normalized = normalize_nfc(value).lower()
    normalized = re.sub(r"\s*[_/\\-]+\s*", "_", normalized)

    pieces: list[str] = []
    for char in normalized:
        if char in CYRILLIC_TRANSLITERATION:
            pieces.append(CYRILLIC_TRANSLITERATION[char])
        elif char.isascii() and char.isalnum():
            pieces.append(char)
        else:
            pieces.append("_")

    slug = re.sub(r"_+", "_", "".join(pieces)).strip("_")
    return f"subcategory_{slug}"


SYSTEM_CATEGORIES = [
    {
        "id": entry["id"],
        "name": entry["title"],
        "icon_key": entry["icon_key"],
        "sort_order": entry["sort_order"],
    }
    for entry in CATEGORY_DEFINITIONS
]

SYSTEM_SUBCATEGORIES = [
    {
        "id": slugify_subcategory(raw_subcategory),
        "category_id": CATEGORY_BY_RAW_LABEL[raw_category]["id"],
        "raw_category": raw_category,
        "raw_label": raw_subcategory,
        "name": format_subcategory_display_name(raw_subcategory),
        "normalized_name": normalize_name(format_subcategory_display_name(raw_subcategory)),
        "is_system": True,
    }
    for raw_category, raw_subcategory in SYSTEM_TAXONOMY_ROWS
]
