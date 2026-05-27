from app.tasks.wardrobe_tasks import _apply_ml_predictions_to_payload, _resolve_catalog_generation_context


def test_category_prediction_is_merged_into_draft_payload():
    payload = {
        "title": "Белая рубашка",
        "categoryId": "tops",
        "subcategory": "",
        "colorIds": [],
    }
    predictions = {
        "category": {
            "categoryId": "tops",
            "categoryTitle": "Верх",
            "subcategoryId": "subcategory_rubashka",
            "subcategory": "Рубашка",
            "subcategoryKey": "Рубашка",
            "confidence": 0.86,
            "top3": [
                {
                    "rank": 1,
                    "categoryId": "tops",
                    "categoryTitle": "Верх",
                    "subcategoryId": "subcategory_rubashka",
                    "subcategory": "Рубашка",
                    "subcategoryKey": "Рубашка",
                    "confidence": 0.86,
                }
            ],
        },
        "colors": {
            "color_ids": ["white_pure"],
            "colors": [],
            "strategy": "single-family",
            "is_multicolor": False,
            "confidence": 0.91,
        },
    }

    merged = _apply_ml_predictions_to_payload(payload, predictions)

    assert merged["categoryId"] == "tops"
    assert merged["subcategory"] == "Рубашка"
    assert merged["categoryPrediction"]["subcategoryId"] == "subcategory_rubashka"
    assert merged["subcategorySuggestions"][0]["subcategory"] == "Рубашка"
    assert merged["recognitionLabel"] == "Распознано: Рубашка (86%)"
    assert merged["colorIds"] == ["white_pure"]
    assert merged["colorPrediction"]["strategy"] == "single-family"


def test_catalog_generation_context_prefers_user_selected_values():
    payload = {
        "categoryId": "outerwear",
        "subcategory": "Куртка",
        "subcategoryId": "manual_subcategory",
        "colorIds": ["black_pure"],
        "categoryPrediction": {
            "categoryId": "tops",
            "subcategory": "Рубашка",
            "subcategoryId": "subcategory_rubashka",
        },
        "colorPrediction": {"color_ids": ["white_pure"]},
    }

    context = _resolve_catalog_generation_context(payload)

    assert context["category_hint"] == "outerwear"
    assert context["subcategory_name"] == "Куртка"
    assert context["subcategory_id"] == "manual_subcategory"
    assert context["color_ids"] == ["black_pure"]
