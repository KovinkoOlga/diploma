import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

pytest.importorskip("torch")
pytest.importorskip("diffusers")
pytest.importorskip("tryoffdiff")

from app.main import app


client = TestClient(app)


def _png_bytes() -> bytes:
    image = Image.new("RGB", (8, 8), color=(255, 255, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_provider_route_endpoint_includes_provider_status() -> None:
    response = client.get("/debug/provider-route", params={"category": "Обувь"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["normalized_category"] == "shoes"
    assert payload["provider"] == "ip_adapter"
    assert payload["model_key"] == "product"
    assert payload["prompt_type"] == "shoes"
    assert payload["provider_enabled"] is False
    assert payload["provider_status"] == "disabled"
    assert payload["ip_base_model"] == "sd15"
    assert payload["tryoffdiff_mode"] is None


def test_provider_route_for_tryoffdiff_includes_mode() -> None:
    response = client.get("/debug/provider-route", params={"category": "Верх"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "tryoffdiff"
    assert payload["provider_enabled"] is True
    assert payload["provider_status"] in {"ready", "missing"}
    assert payload["tryoffdiff_mode"] == "multi"
    assert payload["ip_base_model"] is None


def test_health_endpoint_shape() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "device" in payload
    assert "offline_flags" in payload
    assert "models_dir_exists" in payload
    assert "providers_enabled" in payload
    assert "providers_known" in payload
    assert "providers" in payload
    assert payload["providers"]["ip_adapter"]["status"] == "disabled"


def test_generate_catalog_returns_controlled_failure_when_ip_adapter_disabled() -> None:
    image_bytes = _png_bytes()
    response = client.post(
        "/v1/generate-catalog",
        data={"category": "Обувь"},
        files={
            "original_image": ("original.png", image_bytes, "image/png"),
            "cutout_image": ("cutout.png", image_bytes, "image/png"),
            "mask_image": ("mask.png", image_bytes, "image/png"),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "ip_adapter"
    assert payload["generation_status"] == "failed"
    assert payload["model_used"] == "disabled"
    assert payload["error_message"] == "IP-Adapter provider is disabled"
