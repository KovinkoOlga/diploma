from __future__ import annotations

import re
import unicodedata


COLOR_ID_TO_PROMPT_TEXT = {
    "white": "white",
    "white_pure": "white",
    "white_milky": "milky white",
    "black": "black",
    "black_pure": "black",
    "black_graphite": "graphite black",
    "black_blue": "blue black",
    "gray": "gray",
    "gray_light": "light gray",
    "gray_neutral": "gray",
    "gray_dark": "dark gray",
    "beige": "beige",
    "beige_light": "light beige",
    "beige_neutral": "beige",
    "beige_sand": "sand beige",
    "beige_taupe": "taupe beige",
    "brown": "brown",
    "brown_neutral": "brown",
    "brown_dark": "dark brown",
    "brown_chocolate": "chocolate brown",
    "brown_caramel": "caramel brown",
    "red": "red",
    "red_neutral": "red",
    "red_burgundy": "burgundy",
    "red_coral": "coral red",
    "pink": "pink",
    "pink_neutral": "pink",
    "pink_powder": "powder pink",
    "pink_fuchsia": "fuchsia pink",
    "purple": "purple",
    "purple_lavender": "lavender purple",
    "purple_neutral": "purple",
    "purple_plum": "plum purple",
    "blue": "blue",
    "blue_light": "light blue",
    "blue_neutral": "blue",
    "blue_dark": "dark blue",
    "blue_denim": "denim blue",
    "green": "green",
    "green_neutral": "green",
    "green_khaki": "khaki green",
    "green_mint": "mint green",
    "yellow": "yellow",
    "yellow_neutral": "yellow",
    "yellow_lemon": "lemon yellow",
    "yellow_mustard": "mustard yellow",
    "yellow_vanilla": "vanilla yellow",
    "orange": "orange",
    "orange_neutral": "orange",
    "orange_peach": "peach orange",
    "orange_ginger": "ginger orange",
    "metallic": "metallic",
    "gold": "gold",
    "silver": "silver",
    "multicolor": "multicolor",
    "transparent": "transparent",
    "special": None,
}

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

RAW_SUBCATEGORY_ALIASES = {
    "футболка": "t-shirt",
    "лонгслив": "long sleeve t-shirt",
    "топ": "top",
    "топик": "top",
    "майка": "tank top",
    "рубашка": "shirt",
    "блузка": "blouse",
    "поло": "polo shirt",
    "свитер": "sweater",
    "джемпер": "jumper",
    "кардиган": "cardigan",
    "худи": "hoodie",
    "толстовка": "sweatshirt",
    "олимпийка": "track jacket",
    "пиджак": "blazer",
    "жакет": "jacket",
    "джинсовка": "denim jacket",
    "куртка": "jacket",
    "пальто": "coat",
    "тренч": "trench coat",
    "плащ": "raincoat",
    "брюки": "trousers",
    "джинсы": "jeans",
    "шорты": "shorts",
    "юбка": "skirt",
    "платье": "dress",
    "сарафан": "sundress",
    "комбинезон": "jumpsuit",
    "кроссовки": "sneakers",
    "кеды": "sneakers",
    "ботинки": "boots",
    "сапоги": "high boots",
    "туфли": "shoes",
    "сандалии": "sandals",
    "босоножки": "sandals",
    "сумка": "bag",
    "рюкзак": "backpack",
    "шарф": "scarf",
    "шапка": "hat",
    "ремень": "belt",
}

CATEGORY_FALLBACKS = {
    "tops": "top garment",
    "bottoms": "bottom garment",
    "dresses": "dress",
    "onepiece": "one-piece garment",
    "one_piece": "one-piece garment",
    "outerwear": "outerwear garment",
    "shoes": "pair of shoes",
    "bags_accessories": "fashion accessory",
    "accessories": "fashion accessory",
    "unknown": "clothing or fashion item",
}


def normalize_text(value: str | None) -> str:
    normalized = unicodedata.normalize("NFC", str(value or "")).replace("ё", "е").replace("Ё", "Е")
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def _slugify_subcategory(value: str) -> str:
    normalized = normalize_text(value).lower()
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
    return f"subcategory_{slug}" if slug else ""


SUBCATEGORY_ALIASES: dict[str, str] = {}
for raw_name, english_name in RAW_SUBCATEGORY_ALIASES.items():
    normalized_name = normalize_text(raw_name).lower()
    SUBCATEGORY_ALIASES[normalized_name] = english_name
    slug = _slugify_subcategory(raw_name)
    if slug:
        SUBCATEGORY_ALIASES[slug] = english_name


def color_id_to_prompt_text(color_id: str) -> str | None:
    normalized = normalize_text(color_id).lower()
    if not normalized:
        return None
    mapped = COLOR_ID_TO_PROMPT_TEXT.get(normalized)
    if mapped is not None or normalized in COLOR_ID_TO_PROMPT_TEXT:
        return mapped

    safe_phrase = normalized.replace("_", " ").replace("-", " ")
    safe_phrase = re.sub(r"\s+", " ", safe_phrase).strip()
    if (
        safe_phrase
        and len(safe_phrase) <= 40
        and len(safe_phrase.split()) <= 4
        and re.fullmatch(r"[a-z ]+", safe_phrase)
    ):
        return safe_phrase
    return None


def build_color_phrase(color_ids: list[str] | None) -> str | None:
    phrases: list[str] = []
    seen: set[str] = set()
    for color_id in color_ids or []:
        phrase = color_id_to_prompt_text(color_id)
        if not phrase:
            continue
        if phrase == "multicolor":
            return "multicolor"
        if phrase in seen:
            continue
        seen.add(phrase)
        phrases.append(phrase)

    if not phrases:
        return None
    if len(phrases) == 1:
        return phrases[0]
    if len(phrases) == 2:
        return f"{phrases[0]} and {phrases[1]}"
    return f"{', '.join(phrases[:-1])} and {phrases[-1]}"


def _looks_like_short_english_fashion_phrase(value: str) -> bool:
    return bool(
        value
        and len(value) <= 48
        and len(value.split()) <= 5
        and re.fullmatch(r"[a-z][a-z\s\-]*", value)
    )


def resolve_subcategory_prompt_text(
    subcategory_id: str | None,
    subcategory_name: str | None,
    category_hint: str | None,
) -> str | None:
    normalized_id = normalize_text(subcategory_id).lower()
    normalized_name = normalize_text(subcategory_name).lower()

    if normalized_id in SUBCATEGORY_ALIASES:
        return SUBCATEGORY_ALIASES[normalized_id]
    if normalized_name in SUBCATEGORY_ALIASES:
        return SUBCATEGORY_ALIASES[normalized_name]
    if _looks_like_short_english_fashion_phrase(normalized_name):
        return normalized_name
    return None


def build_catalog_prompt(
    category_hint: str | None,
    subcategory_id: str | None = None,
    subcategory_name: str | None = None,
    color_ids: list[str] | None = None,
) -> tuple[str, str, dict]:
    normalized_category = normalize_text(category_hint).lower() or "unknown"
    category_prompt_text = CATEGORY_FALLBACKS.get(normalized_category, CATEGORY_FALLBACKS["unknown"])
    subcategory_prompt_text = resolve_subcategory_prompt_text(subcategory_id, subcategory_name, normalized_category)
    color_phrase = build_color_phrase(color_ids)
    clean_color_ids = [normalize_text(color_id) for color_id in (color_ids or []) if normalize_text(color_id)]

    if color_phrase and subcategory_prompt_text:
        item_description = f"{color_phrase} {subcategory_prompt_text}"
    elif color_phrase and category_prompt_text:
        item_description = f"{color_phrase} {category_prompt_text}"
    elif subcategory_prompt_text:
        item_description = subcategory_prompt_text
    else:
        item_description = category_prompt_text

    positive_prompt = (
        f"Photorealistic ghost mannequin ecommerce product photo of exact same {item_description}. "
        "Front-facing centered isolated garment, clean white studio background. "
        "Preserve exact color, pattern, silhouette, fabric, seams, buttons, pockets, collar and sleeves."
    )
    negative_prompt = (
        "person, human body, face, hands, arms, legs, hanger, hook, visible mannequin, extra objects, props, "
        "text, watermark, logo, illustration, watercolor, painting, sketch, blurry, low quality, distorted, "
        "deformed, wrong pattern, wrong color"
    )

    metadata = {
        "category_prompt_text": category_prompt_text,
        "subcategory_prompt_text": subcategory_prompt_text,
        "color_prompt_text": color_phrase,
        "color_ids": clean_color_ids,
    }
    return positive_prompt, negative_prompt, metadata
