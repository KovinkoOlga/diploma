from app.utils.classifier_taxonomy import (
    ClassifierTaxonomy,
    extract_top_k,
    format_subcategory_display_name,
    normalize_nfc,
    slugify_subcategory,
)


ARTIFACTS_DIR = "models/classifier_artifacts"


def test_classifier_taxonomy_loads_taxonomy_csv():
    taxonomy = ClassifierTaxonomy.from_artifacts(ARTIFACTS_DIR)

    assert len(taxonomy.categories_by_index) == 6
    assert len(taxonomy.subcategories_by_index) == 50
    assert taxonomy.categories_by_index[0].raw_label == "верх"
    assert taxonomy.subcategories_by_index[11].raw_label == "Рубашка"


def test_unicode_nfc_normalization_handles_decomposed_labels():
    assert normalize_nfc("Майка") == "Майка"
    assert normalize_nfc("Головной убор") == "Головной убор"
    assert format_subcategory_display_name("Кроссовки _ кеды") == "Кроссовки / кеды"


def test_russian_model_label_maps_to_stable_ids_and_display_names():
    taxonomy = ClassifierTaxonomy.from_artifacts(ARTIFACTS_DIR)
    descriptor = taxonomy.subcategories_by_index[33]

    assert descriptor.raw_label == "Кроссовки _ кеды"
    assert descriptor.category_id == "shoes"
    assert descriptor.category_title == "Обувь"
    assert descriptor.display_name == "Кроссовки / кеды"
    assert descriptor.subcategory_id == "subcategory_krossovki_kedy"
    assert slugify_subcategory("Головной убор") == "subcategory_golovnoi_ubor"


def test_top_k_extraction_is_sorted_descending():
    result = extract_top_k([0.04, 0.86, 0.08, 0.01], 3)

    assert result == [(1, 0.86), (2, 0.08), (0, 0.04)]
