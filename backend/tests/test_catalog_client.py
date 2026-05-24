import base64
import json

import pytest

from app.modules.ml_clients import catalog_client
from app.modules.ml_clients.catalog_client import CatalogGenerationError, generate_catalog_image


class _Settings:
    ml_request_timeout_seconds = 10
    ml_catalog_service_url = "http://ml-catalog-service:8002"


class _Response:
    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError("HTTP error")

    def json(self) -> dict:
        return self._payload


class _FakeAsyncClient:
    def __init__(self, response: _Response, recorder: dict | None = None, *args, **kwargs) -> None:
        self._response = response
        self._recorder = recorder if recorder is not None else {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def post(self, *args, **kwargs):
        self._recorder["args"] = args
        self._recorder["kwargs"] = kwargs
        return self._response


@pytest.mark.asyncio
async def test_generate_catalog_image_ready_response(monkeypatch):
    recorder: dict = {}
    payload = {
        "catalog_image": base64.b64encode(b"png-bytes").decode("utf-8"),
        "mime_type": "image/png",
        "provider": "sd_turbo_img2img",
        "model_used": "/app/models/sd-turbo-fp16",
        "category": "tops",
        "subcategory_id": "subcategory_futbolka",
        "subcategory_name": "Футболка",
        "subcategory_prompt_text": "t-shirt",
        "color_ids": ["white_milky", "red_burgundy"],
        "color_prompt_text": "milky white and burgundy",
        "deterministic": False,
        "seed": 987654,
        "generation_status": "ready",
        "fallback_used": False,
        "debug": {"cpu_only": True},
    }

    monkeypatch.setattr(catalog_client, "get_settings", lambda: _Settings())
    monkeypatch.setattr(
        catalog_client.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(_Response(payload), recorder, *args, **kwargs),
    )

    result = await generate_catalog_image(
        b"orig",
        b"cutout",
        b"mask",
        category_hint="tops",
        subcategory_id="subcategory_futbolka",
        subcategory_name="Футболка",
        color_ids=["white_milky", "red_burgundy"],
    )

    assert result.catalog_image == b"png-bytes"
    assert result.provider == "sd_turbo_img2img"
    assert result.generation_status == "ready"
    assert result.subcategory_id == "subcategory_futbolka"
    assert result.subcategory_prompt_text == "t-shirt"
    assert result.color_ids == ["white_milky", "red_burgundy"]
    assert result.color_prompt_text == "milky white and burgundy"
    assert result.deterministic is False
    assert result.seed == 987654
    sent_data = recorder["kwargs"]["data"]
    assert sent_data["category_hint"] == "tops"
    assert sent_data["subcategory_id"] == "subcategory_futbolka"
    assert sent_data["subcategory_name"] == "Футболка"
    assert json.loads(sent_data["color_ids_json"]) == ["white_milky", "red_burgundy"]


@pytest.mark.asyncio
async def test_generate_catalog_image_failed_response_raises(monkeypatch):
    payload = {
        "catalog_image": None,
        "provider": "sd_turbo_img2img",
        "model_used": "/app/models/sd-turbo-fp16",
        "category": "tops",
        "subcategory_id": "subcategory_futbolka",
        "subcategory_name": "Футболка",
        "subcategory_prompt_text": "t-shirt",
        "color_ids": ["white_milky"],
        "color_prompt_text": "milky white",
        "deterministic": True,
        "seed": 42,
        "generation_status": "failed",
        "error_message": "Generation failed",
        "debug": {"cpu_only": True},
    }

    monkeypatch.setattr(catalog_client, "get_settings", lambda: _Settings())
    monkeypatch.setattr(
        catalog_client.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(_Response(payload), *args, **kwargs),
    )

    with pytest.raises(CatalogGenerationError, match="Generation failed") as exc_info:
        await generate_catalog_image(b"orig", b"cutout", b"mask", category_hint="tops")

    assert exc_info.value.generation_status == "failed"
    assert exc_info.value.provider == "sd_turbo_img2img"
    assert exc_info.value.subcategory_id == "subcategory_futbolka"
    assert exc_info.value.subcategory_prompt_text == "t-shirt"
    assert exc_info.value.color_ids == ["white_milky"]
    assert exc_info.value.color_prompt_text == "milky white"
    assert exc_info.value.deterministic is True
    assert exc_info.value.seed == 42


@pytest.mark.asyncio
async def test_generate_catalog_image_missing_catalog_image_for_ready_is_error(monkeypatch):
    payload = {
        "catalog_image": None,
        "provider": "sd_turbo_img2img",
        "model_used": "/app/models/sd-turbo-fp16",
        "category": "tops",
        "generation_status": "ready",
    }

    monkeypatch.setattr(catalog_client, "get_settings", lambda: _Settings())
    monkeypatch.setattr(
        catalog_client.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(_Response(payload), *args, **kwargs),
    )

    with pytest.raises(CatalogGenerationError, match="Catalog generation failed"):
        await generate_catalog_image(b"orig", b"cutout", b"mask", category_hint="tops")


@pytest.mark.asyncio
async def test_generate_catalog_image_invalid_base64_raises(monkeypatch):
    payload = {
        "catalog_image": "!!!not-base64!!!",
        "provider": "sd_turbo_img2img",
        "model_used": "/app/models/sd-turbo-fp16",
        "category": "tops",
        "generation_status": "ready",
    }

    monkeypatch.setattr(catalog_client, "get_settings", lambda: _Settings())
    monkeypatch.setattr(
        catalog_client.httpx,
        "AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(_Response(payload), *args, **kwargs),
    )

    with pytest.raises(CatalogGenerationError, match="invalid base64"):
        await generate_catalog_image(b"orig", b"cutout", b"mask", category_hint="tops")
