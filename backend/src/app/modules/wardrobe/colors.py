from __future__ import annotations

from collections.abc import Iterable


COLOR_KIND_SOLID = "solid"
COLOR_KIND_METALLIC = "metallic"
COLOR_KIND_TRANSPARENT = "transparent"
COLOR_KIND_MULTICOLOR = "multicolor"

COLOR_KIND_VALUES = {
    COLOR_KIND_SOLID,
    COLOR_KIND_METALLIC,
    COLOR_KIND_TRANSPARENT,
    COLOR_KIND_MULTICOLOR,
}

PARENT_COLOR_IDS = {
    "white",
    "black",
    "gray",
    "beige",
    "brown",
    "red",
    "pink",
    "purple",
    "blue",
    "green",
    "yellow",
    "orange",
    "metallic",
    "special",
}

MULTICOLOR_ID = "multicolor"
TRANSPARENT_ID = "transparent"
METALLIC_COLOR_IDS = {"gold", "silver"}


def _parent(color_id: str, name: str, hex_value: str, sort_order: int) -> dict[str, object | None]:
    return {
        "id": color_id,
        "name": name,
        "parent_color_id": None,
        "hex": hex_value,
        "kind": COLOR_KIND_SOLID if color_id not in {"metallic", "special"} else (COLOR_KIND_METALLIC if color_id == "metallic" else COLOR_KIND_MULTICOLOR),
        "sort_order": sort_order,
    }


def _leaf(
    color_id: str,
    name: str,
    parent_color_id: str,
    hex_value: str,
    sort_order: int,
    *,
    kind: str = COLOR_KIND_SOLID,
) -> dict[str, object | None]:
    return {
        "id": color_id,
        "name": name,
        "parent_color_id": parent_color_id,
        "hex": hex_value,
        "kind": kind,
        "sort_order": sort_order,
    }


SYSTEM_COLOR_CATALOG: list[dict[str, object | None]] = [
    _parent("white", "Белый", "#FFFFFF", 10),
    _leaf("white_pure", "белый", "white", "#FFFFFF", 11),
    _leaf("white_milky", "молочный", "white", "#F6F1E7", 12),
    _parent("black", "Черный", "#111111", 20),
    _leaf("black_pure", "черный", "black", "#111111", 21),
    _leaf("black_graphite", "графитовый", "black", "#30343A", 22),
    _leaf("black_blue", "черно-синий", "black", "#182133", 23),
    _parent("gray", "Серый", "#8B929B", 30),
    _leaf("gray_light", "светло-серый", "gray", "#D1D5DB", 31),
    _leaf("gray_neutral", "серый", "gray", "#8B929B", 32),
    _leaf("gray_dark", "темно-серый", "gray", "#5C626A", 33),
    _parent("beige", "Бежевый", "#D6BE9A", 40),
    _leaf("beige_light", "светло-бежевый", "beige", "#E7D7BD", 41),
    _leaf("beige_neutral", "бежевый", "beige", "#D6BE9A", 42),
    _leaf("beige_sand", "песочный", "beige", "#D8B887", 43),
    _leaf("beige_taupe", "тауп", "beige", "#9A8778", 44),
    _parent("brown", "Коричневый", "#765033", 50),
    _leaf("brown_neutral", "коричневый", "brown", "#765033", 51),
    _leaf("brown_dark", "темно-коричневый", "brown", "#3A2418", 52),
    _leaf("brown_chocolate", "шоколадный", "brown", "#4B2D22", 53),
    _leaf("brown_caramel", "карамельный", "brown", "#AD713A", 54),
    _parent("red", "Красный", "#E32626", 60),
    _leaf("red_neutral", "красный", "red", "#E32626", 61),
    _leaf("red_burgundy", "бордовый", "red", "#7B2430", 62),
    _leaf("red_coral", "коралловый", "red", "#EF6B5A", 63),
    _parent("pink", "Розовый", "#E8A3B5", 70),
    _leaf("pink_neutral", "розовый", "pink", "#E8A3B5", 71),
    _leaf("pink_powder", "пудровый", "pink", "#DDB8C0", 72),
    _leaf("pink_fuchsia", "фуксия", "pink", "#C73584", 73),
    _parent("purple", "Фиолетовый", "#7A55A3", 80),
    _leaf("purple_lavender", "лавандовый", "purple", "#C7B8E4", 81),
    _leaf("purple_neutral", "фиолетовый", "purple", "#7A55A3", 82),
    _leaf("purple_plum", "сливовый", "purple", "#5B345A", 83),
    _parent("blue", "Синий", "#3467B7", 90),
    _leaf("blue_light", "голубой", "blue", "#76B9E8", 91),
    _leaf("blue_neutral", "синий", "blue", "#3467B7", 92),
    _leaf("blue_dark", "темно-синий", "blue", "#203B73", 93),
    _leaf("blue_denim", "джинсовый", "blue", "#4C6F92", 94),
    _parent("green", "Зеленый", "#4B8A55", 100),
    _leaf("green_neutral", "зеленый", "green", "#4B8A55", 101),
    _leaf("green_khaki", "хаки", "green", "#6B7451", 102),
    _leaf("green_mint", "мятный", "green", "#A8DCC8", 103),
    _parent("yellow", "Желтый", "#F0C93C", 110),
    _leaf("yellow_neutral", "желтый", "yellow", "#F0C93C", 111),
    _leaf("yellow_lemon", "лимонный", "yellow", "#F4E86A", 112),
    _leaf("yellow_mustard", "горчичный", "yellow", "#B98A18", 113),
    _leaf("yellow_vanilla", "ванильный", "yellow", "#F4E5A6", 114),
    _parent("orange", "Оранжевый", "#EA7E2C", 120),
    _leaf("orange_neutral", "оранжевый", "orange", "#EA7E2C", 121),
    _leaf("orange_peach", "персиковый", "orange", "#F2B08A", 122),
    _leaf("orange_ginger", "рыжий", "orange", "#C4682C", 123),
    _parent("metallic", "Металлик", "#C9A33A", 130),
    _leaf("gold", "золотой", "metallic", "#C9A33A", 131, kind=COLOR_KIND_METALLIC),
    _leaf("silver", "серебряный", "metallic", "#B7BCC5", 132, kind=COLOR_KIND_METALLIC),
    _parent("special", "Специальные", "#E94B5B", 140),
    _leaf(MULTICOLOR_ID, "мультиколор", "special", "#E94B5B", 141, kind=COLOR_KIND_MULTICOLOR),
    _leaf(TRANSPARENT_ID, "прозрачный", "special", "#DDE6EE", 142, kind=COLOR_KIND_TRANSPARENT),
]

SYSTEM_COLOR_BY_ID = {str(entry["id"]): entry for entry in SYSTEM_COLOR_CATALOG}
LEAF_COLOR_IDS = {color_id for color_id, entry in SYSTEM_COLOR_BY_ID.items() if entry["parent_color_id"] is not None}
SELECTABLE_COLOR_IDS = LEAF_COLOR_IDS.copy()


def _normalize_legacy_value(value: str) -> str:
    return str(value or "").strip().lower().replace("ё", "е")


LEGACY_COLOR_VALUE_TO_ID = {
    **{color_id: color_id for color_id in SELECTABLE_COLOR_IDS},
    "белый": "white_pure",
    "молочный": "white_milky",
    "кремовый": "white_milky",
    "айвори": "white_milky",
    "white_cream": "white_milky",
    "white_ivory": "white_milky",
    "черный": "black_pure",
    "графит": "black_graphite",
    "графитовый": "black_graphite",
    "угольный": "black_graphite",
    "black_charcoal": "black_graphite",
    "серый": "gray_neutral",
    "светло-серый": "gray_light",
    "темно-серый": "gray_dark",
    "пепельный": "gray_light",
    "gray_ash": "gray_light",
    "бежевый": "beige_neutral",
    "светло-бежевый": "beige_light",
    "песочный": "beige_sand",
    "тауп": "beige_taupe",
    "кэмел": "beige_sand",
    "beige_camel": "beige_sand",
    "коричневый": "brown_neutral",
    "темно-коричневый": "brown_dark",
    "шоколадный": "brown_chocolate",
    "карамельный": "brown_caramel",
    "терракотовый": "brown_caramel",
    "brown_terracotta": "brown_caramel",
    "красный": "red_neutral",
    "бордовый": "red_burgundy",
    "винный": "red_burgundy",
    "red_wine": "red_burgundy",
    "коралловый": "red_coral",
    "розовый": "pink_neutral",
    "пудровый": "pink_powder",
    "нежно-розовый": "pink_powder",
    "фуксия": "pink_fuchsia",
    "лососевый": "pink_powder",
    "pink_salmon": "pink_powder",
    "лавандовый": "purple_lavender",
    "сиреневый": "purple_lavender",
    "purple_lilac": "purple_lavender",
    "фиолетовый": "purple_neutral",
    "сливовый": "purple_plum",
    "голубой": "blue_light",
    "нежно-голубой": "blue_light",
    "синий": "blue_neutral",
    "темно-синий": "blue_dark",
    "джинсовый": "blue_denim",
    "зеленый": "green_neutral",
    "хаки": "green_khaki",
    "оливковый": "green_khaki",
    "green_olive": "green_khaki",
    "мятный": "green_mint",
    "желтый": "yellow_neutral",
    "лимонный": "yellow_lemon",
    "горчичный": "yellow_mustard",
    "ванильный": "yellow_vanilla",
    "оранжевый": "orange_neutral",
    "персиковый": "orange_peach",
    "рыжий": "orange_ginger",
    "медный": "orange_ginger",
    "orange_copper": "orange_ginger",
    "золотой": "gold",
    "серебряный": "silver",
    "мультиколор": MULTICOLOR_ID,
    "прозрачный": TRANSPARENT_ID,
}

LEGACY_COLOR_NAME_TO_ID = LEGACY_COLOR_VALUE_TO_ID


def normalize_color_ids(values: Iterable[str]) -> list[str]:
    result: list[str] = []
    for value in values:
        color_id = str(value or "").strip()
        if color_id and color_id not in result:
            result.append(color_id)
    return result


def map_legacy_color_names(names: Iterable[str]) -> list[str]:
    mapped: list[str] = []
    for value in names:
        normalized = _normalize_legacy_value(value)
        color_id = LEGACY_COLOR_VALUE_TO_ID.get(normalized)
        if color_id and color_id not in mapped:
            mapped.append(color_id)
    return mapped


def validate_color_selection(color_ids: Iterable[str], color_rows_by_id: dict[str, dict]) -> list[str]:
    normalized = normalize_color_ids(color_ids)
    if not normalized:
        return []

    invalid = [color_id for color_id in normalized if color_id not in color_rows_by_id]
    if invalid:
        raise ValueError(f"Unknown colorId: {invalid[0]}")

    parent_ids = [color_id for color_id in normalized if color_rows_by_id[color_id]["parent_color_id"] is None]
    if parent_ids:
        raise ValueError("Parent color groups cannot be saved for an item")

    if MULTICOLOR_ID in normalized:
        if len(normalized) != 1:
            raise ValueError("Multicolor cannot be combined with other colors")
        return normalized

    if TRANSPARENT_ID in normalized:
        if len(normalized) != 1:
            raise ValueError("Transparent cannot be combined with other colors")
        return normalized

    if len(normalized) > 2:
        raise ValueError("No more than two colors can be selected")

    return normalized
