import base64
import asyncio
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from app.modules.ml_clients.catalog_client import CatalogGenerationError, generate_catalog_image


class _DummyResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class _DummyClient:
    def __init__(self, payload: dict, *args, **kwargs) -> None:
        self._payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, *args, **kwargs):
        return _DummyResponse(self._payload)


def test_generate_catalog_image_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    encoded = base64.b64encode(b"png-bytes").decode("utf-8")
    payload = {
        "catalog_image": encoded,
        "mime_type": "image/png",
        "provider": "tryoffdiff",
        "model_used": "tryoffdiffv2-upper",
        "category": "tops",
        "generation_status": "ready",
        "error_message": None,
    }

    monkeypatch.setattr(httpx, "AsyncClient", lambda *args, **kwargs: _DummyClient(payload, *args, **kwargs))

    result = asyncio.run(generate_catalog_image(b"o", b"c", b"m"))

    assert result.catalog_image == b"png-bytes"
    assert result.provider == "tryoffdiff"
    assert result.model_used == "tryoffdiffv2-upper"
    assert result.category == "tops"
    assert result.generation_status == "ready"


def test_generate_catalog_image_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {
        "catalog_image": None,
        "mime_type": None,
        "provider": "ip_adapter",
        "model_used": "product",
        "category": "shoes",
        "generation_status": "failed",
        "error_message": "model files are missing",
    }

    monkeypatch.setattr(httpx, "AsyncClient", lambda *args, **kwargs: _DummyClient(payload, *args, **kwargs))

    with pytest.raises(CatalogGenerationError, match="model files are missing"):
        asyncio.run(generate_catalog_image(b"o", b"c", b"m"))
