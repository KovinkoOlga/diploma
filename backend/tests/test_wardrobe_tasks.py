import pytest

from app.tasks.wardrobe_tasks import _apply_ml_predictions_to_payload
from app.tasks import wardrobe_tasks
from app.modules.ml_clients.catalog_client import CatalogGenerationResult
from app.modules.wardrobe import service as wardrobe_service


class _FakeResult:
    def mappings(self):
        return self

    def first(self):
        return None


class _FakeConnection:
    async def execute(self, *_args, **_kwargs):
        return _FakeResult()


class _FakeBegin:
    async def __aenter__(self):
        return _FakeConnection()

    async def __aexit__(self, exc_type, exc, tb):
        return None


class _FakeEngine:
    def begin(self):
        return _FakeBegin()


class _FakeServiceConnection:
    def __init__(self) -> None:
        self.execute_calls = 0
        self.commit_calls = 0

    async def execute(self, *_args, **_kwargs):
        self.execute_calls += 1
        return _FakeResult()

    async def commit(self):
        self.commit_calls += 1


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


def _ready_draft() -> dict:
    return {
        "id": "draft_1",
        "user_id": "user_1",
        "processing_status": "ready",
        "catalog_processing_status": "ready",
        "catalog_file_id": "file_old",
        "original_file_id": "file_original",
        "processed_file_id": "file_cutout",
        "mask_file_id": "file_mask",
        "suggested_payload_json": {
            "categoryId": "tops",
            "subcategory": "Футболка",
            "colorIds": ["white_milky", "red_burgundy"],
            "categoryPrediction": {"subcategoryId": "subcategory_futbolka", "subcategory": "Футболка"},
        },
        "ml_result_json": {},
    }


async def _fake_catalog_generation_result() -> CatalogGenerationResult:
    return CatalogGenerationResult(
        catalog_image=b"\x89PNG\r\n\x1a\nfake",
        mime_type="image/png",
        provider="sd_turbo_img2img",
        model_used="/app/models/sd-turbo-fp16",
        category="tops",
        subcategory_id="subcategory_futbolka",
        subcategory_name="Футболка",
        subcategory_prompt_text="t-shirt",
        color_ids=["white_milky", "red_burgundy"],
        color_prompt_text="milky white and burgundy",
        deterministic=False,
        seed=123456,
        generation_status="ready",
        fallback_used=False,
        debug={
            "seed": 123456,
            "deterministic": False,
            "transparent_background": True,
            "background_threshold": 30.0,
            "background_feather": 20.0,
            "result_margin_ratio": 0.06,
        },
    )


@pytest.mark.asyncio
async def test_run_enhance_catalog_photo_does_not_skip_when_ready_with_existing_catalog(monkeypatch):
    draft = _ready_draft()
    create_calls: list[dict] = []
    generated = {"called": False}
    generation_kwargs: dict = {}

    async def fake_get_draft_row(_draft_id: str):
        return dict(draft)

    async def fake_get_file_bytes(_connection, _file_id: str, _variant_type: str):
        return b"ok"

    async def fake_file_name(_file_id: str | None):
        return "item.png"

    async def fake_generate_catalog_image(*_args, **_kwargs):
        generated["called"] = True
        generation_kwargs.update(_kwargs)
        return await _fake_catalog_generation_result()

    async def fake_create_image_file_with_variants(_connection, _user_id, content_by_variant, filename, mime_type):
        create_calls.append(
            {
                "content_by_variant": dict(content_by_variant),
                "filename": filename,
                "mime_type": mime_type,
            }
        )
        return "file_new_catalog"

    monkeypatch.setattr(wardrobe_tasks, "_get_draft_row", fake_get_draft_row)
    monkeypatch.setattr(wardrobe_tasks, "engine", _FakeEngine())
    monkeypatch.setattr(wardrobe_tasks, "get_file_bytes", fake_get_file_bytes)
    monkeypatch.setattr(wardrobe_tasks, "_file_name", fake_file_name)
    monkeypatch.setattr(wardrobe_tasks, "generate_catalog_image", fake_generate_catalog_image)
    monkeypatch.setattr(wardrobe_tasks, "create_image_file_with_variants", fake_create_image_file_with_variants)

    await wardrobe_tasks.run_enhance_catalog_photo("draft_1")

    assert generated["called"] is True
    assert len(create_calls) == 1
    assert create_calls[0]["mime_type"] == "image/png"
    assert set(create_calls[0]["content_by_variant"].keys()) == {"catalog", "card", "thumbnail"}
    assert create_calls[0]["content_by_variant"]["catalog"] == create_calls[0]["content_by_variant"]["card"]
    assert create_calls[0]["content_by_variant"]["catalog"] == create_calls[0]["content_by_variant"]["thumbnail"]
    assert generation_kwargs["category_hint"] == "tops"
    assert generation_kwargs["subcategory_id"] == "subcategory_futbolka"
    assert generation_kwargs["subcategory_name"] == "Футболка"
    assert generation_kwargs["color_ids"] == ["white_milky", "red_burgundy"]


@pytest.mark.asyncio
async def test_run_enhance_catalog_photo_writes_png_variants_with_alpha_payload(monkeypatch):
    draft = _ready_draft()
    create_calls: list[dict] = []

    async def fake_get_draft_row(_draft_id: str):
        return dict(draft)

    async def fake_get_file_bytes(_connection, _file_id: str, _variant_type: str):
        return b"ok"

    async def fake_file_name(_file_id: str | None):
        return "item.png"

    async def fake_generate_catalog_image(*_args, **_kwargs):
        return await _fake_catalog_generation_result()

    async def fake_create_image_file_with_variants(_connection, _user_id, content_by_variant, filename, mime_type):
        create_calls.append(
            {
                "content_by_variant": dict(content_by_variant),
                "filename": filename,
                "mime_type": mime_type,
            }
        )
        return "file_new_catalog"

    monkeypatch.setattr(wardrobe_tasks, "_get_draft_row", fake_get_draft_row)
    monkeypatch.setattr(wardrobe_tasks, "engine", _FakeEngine())
    monkeypatch.setattr(wardrobe_tasks, "get_file_bytes", fake_get_file_bytes)
    monkeypatch.setattr(wardrobe_tasks, "_file_name", fake_file_name)
    monkeypatch.setattr(wardrobe_tasks, "generate_catalog_image", fake_generate_catalog_image)
    monkeypatch.setattr(wardrobe_tasks, "create_image_file_with_variants", fake_create_image_file_with_variants)

    await wardrobe_tasks.run_enhance_catalog_photo("draft_1")

    assert len(create_calls) == 1
    assert create_calls[0]["mime_type"] == "image/png"
    assert create_calls[0]["filename"].startswith("catalog-")
    for variant_name, payload in create_calls[0]["content_by_variant"].items():
        assert variant_name in {"catalog", "card", "thumbnail"}
        assert payload.startswith(b"\x89PNG\r\n\x1a\n")


@pytest.mark.asyncio
async def test_run_enhance_catalog_photo_stores_extended_catalog_pipeline_metadata(monkeypatch):
    draft = _ready_draft()
    captured_pipeline: dict = {}

    async def fake_get_draft_row(_draft_id: str):
        return dict(draft)

    async def fake_get_file_bytes(_connection, _file_id: str, _variant_type: str):
        return b"ok"

    async def fake_file_name(_file_id: str | None):
        return "item.png"

    async def fake_generate_catalog_image(*_args, **_kwargs):
        return await _fake_catalog_generation_result()

    async def fake_create_image_file_with_variants(_connection, _user_id, _content_by_variant, _filename, _mime_type):
        return "file_new_catalog"

    def fake_merge_ml_result(_current: dict | None, _key: str, value: dict):
        captured_pipeline.clear()
        captured_pipeline.update(value)
        return {"catalog_pipeline": value}

    monkeypatch.setattr(wardrobe_tasks, "_get_draft_row", fake_get_draft_row)
    monkeypatch.setattr(wardrobe_tasks, "engine", _FakeEngine())
    monkeypatch.setattr(wardrobe_tasks, "get_file_bytes", fake_get_file_bytes)
    monkeypatch.setattr(wardrobe_tasks, "_file_name", fake_file_name)
    monkeypatch.setattr(wardrobe_tasks, "generate_catalog_image", fake_generate_catalog_image)
    monkeypatch.setattr(wardrobe_tasks, "create_image_file_with_variants", fake_create_image_file_with_variants)
    monkeypatch.setattr(wardrobe_tasks, "_merge_ml_result", fake_merge_ml_result)

    await wardrobe_tasks.run_enhance_catalog_photo("draft_1")

    assert captured_pipeline["category"] == "tops"
    assert captured_pipeline["subcategory_id"] == "subcategory_futbolka"
    assert captured_pipeline["subcategory_name"] == "Футболка"
    assert captured_pipeline["subcategory_prompt_text"] == "t-shirt"
    assert captured_pipeline["color_ids"] == ["white_milky", "red_burgundy"]
    assert captured_pipeline["color_prompt_text"] == "milky white and burgundy"
    assert captured_pipeline["deterministic"] is False
    assert captured_pipeline["seed"] == 123456
    assert captured_pipeline["transparent_background"] is True
    assert captured_pipeline["background_threshold"] == 30.0
    assert captured_pipeline["background_feather"] == 20.0
    assert captured_pipeline["result_margin_ratio"] == 0.06


@pytest.mark.asyncio
async def test_run_enhance_catalog_photo_uses_prompt_context_override(monkeypatch):
    draft = _ready_draft()
    generation_kwargs: dict = {}

    async def fake_get_draft_row(_draft_id: str):
        return dict(draft)

    async def fake_get_file_bytes(_connection, _file_id: str, _variant_type: str):
        return b"ok"

    async def fake_file_name(_file_id: str | None):
        return "item.png"

    async def fake_generate_catalog_image(*_args, **_kwargs):
        generation_kwargs.update(_kwargs)
        return await _fake_catalog_generation_result()

    async def fake_create_image_file_with_variants(_connection, _user_id, _content_by_variant, _filename, _mime_type):
        return "file_new_catalog"

    monkeypatch.setattr(wardrobe_tasks, "_get_draft_row", fake_get_draft_row)
    monkeypatch.setattr(wardrobe_tasks, "engine", _FakeEngine())
    monkeypatch.setattr(wardrobe_tasks, "get_file_bytes", fake_get_file_bytes)
    monkeypatch.setattr(wardrobe_tasks, "_file_name", fake_file_name)
    monkeypatch.setattr(wardrobe_tasks, "generate_catalog_image", fake_generate_catalog_image)
    monkeypatch.setattr(wardrobe_tasks, "create_image_file_with_variants", fake_create_image_file_with_variants)

    prompt_context_override = {
        "categoryId": "outerwear",
        "subcategoryId": "subcategory_trench",
        "subcategory": "Тренч",
        "colorIds": ["black_graphite"],
    }
    await wardrobe_tasks.run_enhance_catalog_photo(
        "draft_1",
        prompt_context_override=prompt_context_override,
    )

    assert generation_kwargs["category_hint"] == "outerwear"
    assert generation_kwargs["subcategory_id"] == "subcategory_trench"
    assert generation_kwargs["subcategory_name"] == "Тренч"
    assert generation_kwargs["color_ids"] == ["black_graphite"]


@pytest.mark.asyncio
async def test_enhance_draft_allows_repeat_after_ready(monkeypatch):
    connection = _FakeServiceConnection()
    trigger = {"called": False}

    async def fake_load_draft_row(_connection, _user_id, _draft_id):
        return {
            "id": "draft_1",
            "processing_status": "ready",
            "catalog_processing_status": "ready",
            "original_file_id": "file_orig",
            "processed_file_id": "file_cutout",
            "mask_file_id": "file_mask",
        }

    async def fake_get_draft(_connection, _user_id, _draft_id):
        return {"id": "draft_1", "catalogProcessingStatus": "queued"}

    async def fake_trigger(_draft_id: str, *, prompt_context_override=None):
        trigger["called"] = True

    monkeypatch.setattr(wardrobe_service, "_load_draft_row", fake_load_draft_row)
    monkeypatch.setattr(wardrobe_service, "get_draft", fake_get_draft)
    monkeypatch.setattr(wardrobe_tasks, "trigger_enhance_catalog_photo_task", fake_trigger)

    result = await wardrobe_service.enhance_draft(connection, "user_1", "draft_1")

    assert trigger["called"] is True
    assert connection.execute_calls == 1
    assert connection.commit_calls == 1
    assert result["catalogProcessingStatus"] == "queued"


@pytest.mark.asyncio
async def test_enhance_draft_passes_prompt_context_override(monkeypatch):
    connection = _FakeServiceConnection()
    captured: dict = {}

    async def fake_load_draft_row(_connection, _user_id, _draft_id):
        return {
            "id": "draft_1",
            "processing_status": "ready",
            "catalog_processing_status": "ready",
            "original_file_id": "file_orig",
            "processed_file_id": "file_cutout",
            "mask_file_id": "file_mask",
        }

    async def fake_get_draft(_connection, _user_id, _draft_id):
        return {"id": "draft_1", "catalogProcessingStatus": "queued"}

    async def fake_trigger(_draft_id: str, *, prompt_context_override=None):
        captured["draft_id"] = _draft_id
        captured["prompt_context_override"] = prompt_context_override

    monkeypatch.setattr(wardrobe_service, "_load_draft_row", fake_load_draft_row)
    monkeypatch.setattr(wardrobe_service, "get_draft", fake_get_draft)
    monkeypatch.setattr(wardrobe_tasks, "trigger_enhance_catalog_photo_task", fake_trigger)

    prompt_context_override = {
        "categoryId": "tops",
        "subcategory": "Футболка",
        "subcategoryId": "subcategory_futbolka",
        "colorIds": ["white_milky"],
    }
    await wardrobe_service.enhance_draft(
        connection,
        "user_1",
        "draft_1",
        prompt_context_override=prompt_context_override,
    )

    assert captured["draft_id"] == "draft_1"
    assert captured["prompt_context_override"] == prompt_context_override
