from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.settings import get_settings


def test_health_does_not_load_model(monkeypatch):
    client = TestClient(app)
    called = {"generate": False}

    def fail_generate(*args, **kwargs):
        called["generate"] = True
        raise AssertionError("Provider should not load during health")

    monkeypatch.setattr("app.main.catalog_provider.generate", fail_generate)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["provider"] == get_settings().catalog_provider
    assert called["generate"] is False


def test_stub_mode_returns_ready(monkeypatch):
    monkeypatch.setenv("CATALOG_ENABLE_STUB", "true")
    get_settings.cache_clear()
    client = TestClient(app)
    image = Image.new("RGBA", (512, 512), (255, 255, 255, 0))

    import io

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    content = buffer.getvalue()

    response = client.post(
        "/v1/generate-catalog",
        files={
            "original_image": ("original.png", content, "image/png"),
            "cutout_image": ("cutout.png", content, "image/png"),
            "mask_image": ("mask.png", content, "image/png"),
        },
        data={"category_hint": "tops", "color_ids_json": '["white_pure"]'},
    )

    assert response.status_code == 200
    assert response.json()["generation_status"] == "ready"
    assert response.json()["catalog_image"]
    monkeypatch.delenv("CATALOG_ENABLE_STUB", raising=False)
    get_settings.cache_clear()
