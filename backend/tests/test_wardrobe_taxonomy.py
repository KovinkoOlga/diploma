from app.modules.wardrobe.taxonomy import (
    CATEGORY_BY_RAW_LABEL,
    SYSTEM_SUBCATEGORIES,
    format_subcategory_display_name,
    normalize_name,
    normalize_nfc,
    slugify_subcategory,
)


def test_unicode_nfc_normalization_handles_decomposed_values():
    assert normalize_nfc("Майка") == "Майка"
    assert normalize_nfc("Дублёнка") == "Дублёнка"
    assert normalize_name("Кроссовки _ кеды") == "кроссовки кеды"


def test_model_label_maps_to_stable_ids_and_display_names():
    accessories = CATEGORY_BY_RAW_LABEL["сумки и аксессуары"]
    shoes_entry = next(entry for entry in SYSTEM_SUBCATEGORIES if entry["raw_label"] == "Кроссовки _ кеды")

    assert accessories["id"] == "bags_accessories"
    assert accessories["title"] == "Сумки и аксессуары"
    assert format_subcategory_display_name("Тапки_шлёпки") == "Тапки / шлёпки"
    assert shoes_entry["category_id"] == "shoes"
    assert shoes_entry["name"] == "Кроссовки / кеды"
    assert shoes_entry["id"] == "subcategory_krossovki_kedy"
    assert slugify_subcategory("Головной убор") == "subcategory_golovnoi_ubor"
