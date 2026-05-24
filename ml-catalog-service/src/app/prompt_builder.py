from __future__ import annotations

import re
from typing import Any


CATEGORY_HINTS = {
    "tops": "top garment",
    "bottoms": "bottom garment",
    "dresses": "one-piece garment or dress",
    "onepiece": "one-piece garment or dress",
    "one_piece": "one-piece garment or dress",
    "outerwear": "outerwear garment",
    "shoes": "pair of shoes",
    "bags_accessories": "fashion accessory",
    "accessories": "fashion accessory",
}

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

SUBCATEGORY_ALIASES = {
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
    # Common system IDs seen in payloads.
    "subcategory_futbolka": "t-shirt",
    "subcategory_longsliv": "long sleeve t-shirt",
    "subcategory_top": "top",
    "subcategory_maika": "tank top",
    "subcategory_rubashka": "shirt",
    "subcategory_bluzka": "blouse",
    "subcategory_polo": "polo shirt",
    "subcategory_sviter": "sweater",
    "subcategory_dzhemper": "jumper",
    "subcategory_kardigan": "cardigan",
    "subcategory_khudi": "hoodie",
    "subcategory_tolstovka": "sweatshirt",
    "subcategory_olimpiika": "track jacket",
    "subcategory_pidzhak": "blazer",
    "subcategory_zhaket": "jacket",
    "subcategory_dzhinsovka": "denim jacket",
    "subcategory_kurtka": "jacket",
    "subcategory_palto": "coat",
    "subcategory_trench_plashch": "trench coat",
    "subcategory_plashch": "raincoat",
    "subcategory_briuki": "trousers",
    "subcategory_dzhinsy": "jeans",
    "subcategory_shorty": "shorts",
    "subcategory_iubka": "skirt",
    "subcategory_plate": "dress",
    "subcategory_sarafan": "sundress",
    "subcategory_kombinezon": "jumpsuit",
    "subcategory_krossovki_kedy": "sneakers",
    "subcategory_kedy": "sneakers",
    "subcategory_botinki": "boots",
    "subcategory_sapogi": "high boots",
    "subcategory_tufli": "shoes",
    "subcategory_sandalii": "sandals",
    "subcategory_bosonozhki_na_kabluke": "sandals",
    "subcategory_sumka_riukzak": "bag",
    "subcategory_riukzak": "backpack",
    "subcategory_sharf": "scarf",
    "subcategory_golovnoi_ubor": "hat",
    "subcategory_remen": "belt",
}

SAFE_COLOR_FALLBACK_RE = re.compile(r"^[a-z][a-z0-9\-\s]{1,30}$")
SAFE_ENGLISH_SUBCATEGORY_RE = re.compile(r"^[a-z][a-z\s\-/]{1,48}$")
CYRILLIC_RE = re.compile(r"[а-яё]")


def normalize_text(value: str | None) -> str:
    normalized = str(value or "").strip().lower().replace("ё", "е")
    return re.sub(r"\s+", " ", normalized)


def color_id_to_prompt_text(color_id: str) -> str | None:
    normalized = normalize_text(color_id).replace("-", "_")
    if not normalized:
        return None
    if normalized in COLOR_ID_TO_PROMPT_TEXT:
        return COLOR_ID_TO_PROMPT_TEXT[normalized]

    candidate = normalized.replace("_", " ")
    candidate = re.sub(r"\s+", " ", candidate).strip()
    if not SAFE_COLOR_FALLBACK_RE.fullmatch(candidate):
        return None

    bad_tokens = {"color", "colour", "id", "group", "parent", "child", "family", "variant"}
    filtered = [token for token in candidate.split(" ") if token and token not in bad_tokens]
    if not filtered:
        return None
    if len(filtered) > 4:
        return None
    return " ".join(filtered)


def build_color_phrase(color_ids: list[str] | None) -> str | None:
    seen_ids: set[str] = set()
    phrases: list[str] = []
    for color_id in color_ids or []:
        normalized_id = normalize_text(color_id).replace("-", "_")
        if not normalized_id or normalized_id in seen_ids:
            continue
        seen_ids.add(normalized_id)
        phrase = color_id_to_prompt_text(normalized_id)
        if phrase:
            phrases.append(phrase)

    if not phrases:
        return None
    if "multicolor" in phrases:
        return "multicolor"
    if len(phrases) == 1:
        return phrases[0]
    if len(phrases) == 2:
        return f"{phrases[0]} and {phrases[1]}"
    return f"{', '.join(phrases[:-1])} and {phrases[-1]}"


def resolve_subcategory_prompt_text(
    subcategory_id: str | None,
    subcategory_name: str | None,
    category_hint: str | None,  # noqa: ARG001
) -> str | None:
    normalized_id = normalize_text(subcategory_id).replace("-", "_")
    normalized_name = normalize_text(subcategory_name)

    if normalized_id and normalized_id in SUBCATEGORY_ALIASES:
        return SUBCATEGORY_ALIASES[normalized_id]
    if normalized_name and normalized_name in SUBCATEGORY_ALIASES:
        return SUBCATEGORY_ALIASES[normalized_name]

    if normalized_name and not CYRILLIC_RE.search(normalized_name):
        if SAFE_ENGLISH_SUBCATEGORY_RE.fullmatch(normalized_name):
            tokens = [token for token in re.split(r"[\s/ -]+", normalized_name) if token]
            if 1 <= len(tokens) <= 6:
                return normalized_name

    return None


def build_catalog_prompt(
    category_hint: str | None,
    subcategory_id: str | None = None,
    subcategory_name: str | None = None,
    color_ids: list[str] | None = None,
) -> tuple[str, dict[str, Any]]:
    normalized_category = normalize_text(category_hint).replace("-", "_")
    category_prompt_text = CATEGORY_HINTS.get(normalized_category, "clothing or fashion item")
    subcategory_prompt_text = resolve_subcategory_prompt_text(subcategory_id, subcategory_name, category_hint)
    clean_color_ids = [normalize_text(color_id).replace("-", "_") for color_id in color_ids or [] if normalize_text(color_id)]
    color_prompt_text = build_color_phrase(clean_color_ids)

    item_prompt_text = subcategory_prompt_text or category_prompt_text
    item_description = f"{color_prompt_text} {item_prompt_text}" if color_prompt_text else item_prompt_text
    item_description = re.sub(r"\s+", " ", item_description).strip()

    prompt = (
        f"Photorealistic ghost mannequin ecommerce product photo of same {item_description}. "
        "Front-facing centered isolated garment, clean white studio background. "
        "Preserve exact color, pattern, silhouette, fabric, seams, buttons, pockets, collar and sleeves. "
        "No person, No body, No hands, No face, No hanger, No props, No illustration, No watercolor, No painting."
    )

    metadata = {
        "category_prompt_text": category_prompt_text,
        "subcategory_prompt_text": subcategory_prompt_text,
        "color_prompt_text": color_prompt_text,
        "color_ids": clean_color_ids,
        "compact_prompt_used": True,
    }
    return prompt, metadata
