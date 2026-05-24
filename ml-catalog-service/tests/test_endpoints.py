import io
from types import SimpleNamespace

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app, provider, settings


def _png_bytes(mode: str = "RGB") -> bytes:
    if mode == "RGBA":
        color = (120, 120, 120, 255)
    elif mode == "L":
        color = 255
    else:
        color = (120, 120, 120)
    image = Image.new(mode, (64, 64), color)
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def _files_payload() -> dict:
    return {
        "original_image": ("orig.png", _png_bytes("RGB"), "image/png"),
        "cutout_image": ("cutout.png", _png_bytes("RGBA"), "image/png"),
        "mask_image": ("mask.png", _png_bytes("L"), "image/png"),
    }


def test_generate_catalog_stub_mode_returns_ready():
    previous_stub = settings.catalog_enable_stub
    previous_force = settings.catalog_force_failure
    settings.catalog_enable_stub = True
    settings.catalog_force_failure = False

    try:
        client = TestClient(app)
        response = client.post(
            "/v1/generate-catalog",
            files=_files_payload(),
            data={
                "category_hint": "tops",
                "subcategory_name": "футболка",
                "color_ids_json": '["white_milky","red_burgundy"]',
            },
        )
        payload = response.json()

        assert response.status_code == 200
        assert payload["generation_status"] == "ready"
        assert payload["fallback_used"] is True
        assert payload["catalog_image"]
        assert payload["subcategory_name"] == "футболка"
        assert payload["subcategory_prompt_text"] == "t-shirt"
        assert payload["color_ids"] == ["white_milky", "red_burgundy"]
        assert payload["color_prompt_text"] == "milky white and burgundy"
        assert payload["seed"] is not None
        assert payload["deterministic"] is not None
        assert payload["debug"]["transparent_background"] == settings.catalog_transparent_background
        assert payload["debug"]["background_threshold"] == settings.catalog_background_threshold
        assert payload["debug"]["background_feather"] == settings.catalog_background_feather
        assert payload["debug"]["result_margin_ratio"] == settings.catalog_result_margin_ratio
        assert payload["debug"]["post_sharpen_enabled"] == settings.catalog_post_sharpen_enabled
        assert payload["debug"]["post_sharpen_radius"] == settings.catalog_post_sharpen_radius
        assert payload["debug"]["post_sharpen_percent"] == settings.catalog_post_sharpen_percent
        assert payload["debug"]["post_sharpen_threshold"] == settings.catalog_post_sharpen_threshold
        assert "prompt_token_count" in payload["debug"]
        assert "prompt_token_limit" in payload["debug"]
        assert "prompt_truncated" in payload["debug"]
        assert payload["debug"]["prompt_metadata"]["subcategory_prompt_text"] == "t-shirt"
    finally:
        settings.catalog_enable_stub = previous_stub
        settings.catalog_force_failure = previous_force


def test_generate_catalog_force_failure_returns_failed():
    previous_stub = settings.catalog_enable_stub
    previous_force = settings.catalog_force_failure
    settings.catalog_enable_stub = False
    settings.catalog_force_failure = True

    try:
        client = TestClient(app)
        response = client.post(
            "/v1/generate-catalog",
            files=_files_payload(),
            data={
                "category_hint": "tops",
                "subcategory_name": "футболка",
                "color_ids_json": "white_milky,red_burgundy",
            },
        )
        payload = response.json()

        assert response.status_code == 200
        assert payload["generation_status"] == "failed"
        assert payload["catalog_image"] is None
        assert payload["subcategory_prompt_text"] == "t-shirt"
        assert payload["color_ids"] == ["white_milky", "red_burgundy"]
        assert payload["color_prompt_text"] == "milky white and burgundy"
    finally:
        settings.catalog_enable_stub = previous_stub
        settings.catalog_force_failure = previous_force


def test_health_contains_model_path_flags():
    client = TestClient(app)
    response = client.get("/health")
    payload = response.json()

    assert response.status_code == 200
    assert "model_path_exists" in payload
    assert "model_index_exists" in payload
    assert payload["background_threshold"] == settings.catalog_background_threshold
    assert payload["background_feather"] == settings.catalog_background_feather
    assert payload["post_sharpen_enabled"] == settings.catalog_post_sharpen_enabled
    assert payload["post_sharpen_radius"] == settings.catalog_post_sharpen_radius
    assert payload["post_sharpen_percent"] == settings.catalog_post_sharpen_percent
    assert payload["post_sharpen_threshold"] == settings.catalog_post_sharpen_threshold


def test_generate_catalog_stub_parses_invalid_color_ids_safely():
    previous_stub = settings.catalog_enable_stub
    previous_force = settings.catalog_force_failure
    settings.catalog_enable_stub = True
    settings.catalog_force_failure = False

    try:
        client = TestClient(app)
        response = client.post(
            "/v1/generate-catalog",
            files=_files_payload(),
            data={
                "category_hint": "tops",
                "subcategory_name": "футболка",
                "color_ids_json": "{not-json}",
            },
        )
        payload = response.json()

        assert response.status_code == 200
        assert payload["generation_status"] == "ready"
        assert payload["subcategory_prompt_text"] == "t-shirt"
        assert payload["color_ids"] == []
    finally:
        settings.catalog_enable_stub = previous_stub
        settings.catalog_force_failure = previous_force


def test_generate_catalog_includes_provider_prompt_tokenization_debug(monkeypatch):
    previous_stub = settings.catalog_enable_stub
    previous_force = settings.catalog_force_failure
    settings.catalog_enable_stub = False
    settings.catalog_force_failure = False

    def fake_generate(_image, _prompt):
        return SimpleNamespace(
            image=Image.new("RGB", (128, 128), (160, 160, 160)),
            provider="sd_turbo_img2img",
            model_used=settings.catalog_model_id,
            debug={
                "seed": 123,
                "deterministic": False,
                "prompt_token_count": 48,
                "prompt_token_limit": 77,
                "prompt_truncated": False,
            },
        )

    monkeypatch.setattr(provider, "generate", fake_generate)

    try:
        client = TestClient(app)
        response = client.post(
            "/v1/generate-catalog",
            files=_files_payload(),
            data={
                "category_hint": "tops",
                "subcategory_name": "футболка",
                "color_ids_json": '["white_milky"]',
            },
        )
        payload = response.json()

        assert response.status_code == 200
        assert payload["generation_status"] == "ready"
        assert payload["debug"]["prompt_token_count"] == 48
        assert payload["debug"]["prompt_token_limit"] == 77
        assert payload["debug"]["prompt_truncated"] is False
    finally:
        settings.catalog_enable_stub = previous_stub
        settings.catalog_force_failure = previous_force
