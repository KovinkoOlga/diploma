import base64

import pytest

from app.modules.ml_clients.catalog_client import CatalogGenerationError, generate_catalog_image


class DummyResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class DummyAsyncClient:
    def __init__(self, *, timeout=None) -> None:
        self.timeout = timeout
        self.payload_factory = lambda url, files, data: {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def post(self, url, files=None, data=None):
        return DummyResponse(self.payload_factory(url, files, data))


@pytest.mark.asyncio
async def test_catalog_client_sends_new_prompt_fields(monkeypatch):
    client = DummyAsyncClient()

    def payload_factory(url, files, data):
        assert data["category_hint"] == "tops"
        assert data["subcategory_id"] == "subcategory_rubashka"
        assert data["subcategory_name"] == "Рубашка"
        assert data["color_ids_json"] == '["white_pure"]'
        return {
            "catalog_image": base64.b64encode(b"png-bytes").decode("ascii"),
            "mime_type": "image/png",
            "provider": "sd15_ip_adapter_inpaint",
            "model_used": "sd15-inpainting-fp16+ip-adapter_sd15_light",
            "category": "tops",
            "subcategory_id": "subcategory_rubashka",
            "subcategory_name": "Рубашка",
            "subcategory_prompt_text": "shirt",
            "color_ids": ["white_pure"],
            "color_prompt_text": "white",
            "generation_status": "ready",
            "fallback_used": False,
            "deterministic": False,
            "seed": 123,
            "debug": {"mask_mode": "full_item"},
        }

    client.payload_factory = payload_factory
    monkeypatch.setattr("app.modules.ml_clients.catalog_client.httpx.AsyncClient", lambda timeout=None: client)

    result = await generate_catalog_image(
        b"original",
        b"cutout",
        b"mask",
        category_hint="tops",
        subcategory_id="subcategory_rubashka",
        subcategory_name="Рубашка",
        color_ids=["white_pure"],
    )

    assert result.catalog_image == b"png-bytes"
    assert result.subcategory_prompt_text == "shirt"
    assert result.debug == {"mask_mode": "full_item"}


@pytest.mark.asyncio
async def test_catalog_client_raises_on_failed_response(monkeypatch):
    client = DummyAsyncClient()
    client.payload_factory = lambda url, files, data: {
        "generation_status": "failed",
        "error_message": "model error",
        "catalog_image": None,
    }
    monkeypatch.setattr("app.modules.ml_clients.catalog_client.httpx.AsyncClient", lambda timeout=None: client)

    with pytest.raises(CatalogGenerationError, match="model error"):
        await generate_catalog_image(b"original", b"cutout", b"mask")
