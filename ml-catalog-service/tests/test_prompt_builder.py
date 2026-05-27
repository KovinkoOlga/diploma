from app.prompt_builder import (
    build_catalog_prompt,
    build_color_phrase,
    color_id_to_prompt_text,
    resolve_subcategory_prompt_text,
)


def test_color_ids_map_to_english_phrases():
    assert color_id_to_prompt_text("white_milky") == "milky white"
    assert color_id_to_prompt_text("black_graphite") == "graphite black"
    assert color_id_to_prompt_text("special") is None


def test_build_color_phrase_deduplicates_and_handles_multicolor():
    assert build_color_phrase(["white_pure", "red_burgundy"]) == "white and burgundy"
    assert build_color_phrase(["white_pure", "white", "multicolor"]) == "multicolor"


def test_subcategory_aliases_and_unknown_russian_handling():
    assert resolve_subcategory_prompt_text("subcategory_rubashka", None, "tops") == "shirt"
    assert resolve_subcategory_prompt_text(None, "Футболка", "tops") == "t-shirt"
    assert resolve_subcategory_prompt_text(None, "Моя кастомная вещь", "tops") is None


def test_prompt_contains_expected_positive_and_negative_phrases():
    positive_prompt, negative_prompt, metadata = build_catalog_prompt(
        "tops",
        subcategory_name="Футболка",
        color_ids=["white_pure"],
    )

    assert "Photorealistic ghost mannequin ecommerce product photo of same white t-shirt." in positive_prompt
    assert "Preserve exact color" in positive_prompt
    assert "person" in negative_prompt
    assert "hanger" in negative_prompt
    assert "watercolor" in negative_prompt
    assert "illustration" in negative_prompt
    assert "wrong color" in negative_prompt
    assert " visible mannequin," in f" {negative_prompt}"
    assert " mannequin," not in negative_prompt.replace("visible mannequin", "")
    assert metadata["subcategory_prompt_text"] == "t-shirt"
    assert metadata["color_prompt_text"] == "white"
