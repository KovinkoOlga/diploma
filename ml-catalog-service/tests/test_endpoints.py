import pytest
from fastapi.testclient import TestClient

pytest.importorskip("torch")
pytest.importorskip("diffusers")
pytest.importorskip("tryoffdiff")

from app.main import app


client = TestClient(app)


def test_provider_route_endpoint() -> None:
    response = client.get("/debug/provider-route", params={"category": "Обувь"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["normalized_category"] == "shoes"
    assert payload["provider"] == "ip_adapter"
    assert payload["model_key"] == "product"
    assert payload["prompt_type"] == "shoes"


def test_health_endpoint_shape() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "device" in payload
    assert "offline_flags" in payload
    assert "models_dir_exists" in payload
    assert "providers_enabled" in payload
    assert "required_files" in payload
