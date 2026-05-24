from app.prompt_builder import (
    build_catalog_prompt,
    build_color_phrase,
    color_id_to_prompt_text,
    resolve_subcategory_prompt_text,
)


def test_color_mapping_uses_ids_and_english_phrases():
    assert color_id_to_prompt_text("white_milky") == "milky white"
    assert color_id_to_prompt_text("blue_dark") == "dark blue"
    assert color_id_to_prompt_text("red_burgundy") == "burgundy"
    assert color_id_to_prompt_text("special") is None


def test_build_color_phrase_handles_multicolor_unknown_and_duplicates():
    assert build_color_phrase(["multicolor", "red_burgundy"]) == "multicolor"
    assert build_color_phrase(["white_milky", "red_burgundy", "white_milky"]) == "milky white and burgundy"
    assert build_color_phrase(["unknown_color_code", "red_burgundy"]) == "unknown code and burgundy"


def test_resolve_subcategory_prompt_text_aliases_and_safe_english():
    assert resolve_subcategory_prompt_text(None, "футболка", "tops") == "t-shirt"
    assert resolve_subcategory_prompt_text(None, "джинсовка", "outerwear") == "denim jacket"
    assert resolve_subcategory_prompt_text(None, "linen shirt", "tops") == "linen shirt"
    assert resolve_subcategory_prompt_text(None, "супер_непонятная_вещь", "tops") is None


def test_build_catalog_prompt_uses_category_subcategory_and_colors():
    prompt, meta = build_catalog_prompt(
        category_hint="tops",
        subcategory_id="subcategory_futbolka",
        subcategory_name="Футболка",
        color_ids=["white_milky", "red_burgundy"],
    )

    assert meta["category_prompt_text"] == "top garment"
    assert meta["subcategory_prompt_text"] == "t-shirt"
    assert meta["color_prompt_text"] == "milky white and burgundy"
    assert meta["color_ids"] == ["white_milky", "red_burgundy"]
    assert meta["compact_prompt_used"] is True
    assert "same milky white and burgundy t-shirt" in prompt
    assert "Photorealistic" in prompt
    assert "ghost mannequin" in prompt
    assert "ecommerce product photo" in prompt
    assert "Preserve exact color" in prompt
    assert "front-facing" in prompt.lower()
    assert "centered" in prompt
    assert "isolated garment" in prompt
    assert "watercolor" in prompt
    assert "illustration" in prompt
    assert "painting" in prompt
    assert "No person" in prompt
    assert "No hanger" in prompt
    assert "No visible mannequin" not in prompt
    assert "Show the item as an invisible mannequin / ghost mannequin product photo" not in prompt
    assert len(prompt) < 430


def test_build_catalog_prompt_skips_unknown_russian_subcategory():
    prompt, meta = build_catalog_prompt(
        category_hint="tops",
        subcategory_name="очень странная вещь",
        color_ids=["white_pure"],
    )

    assert meta["subcategory_prompt_text"] is None
    assert "same white top garment" in prompt
    assert "очень странная вещь" not in prompt
