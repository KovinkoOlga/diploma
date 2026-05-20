from __future__ import annotations

from pydantic import BaseModel


class CatalogGenerationResponse(BaseModel):
    catalog_image: str | None
    mime_type: str | None
    provider: str
    model_used: str
    category: str
    generation_status: str
    error_message: str | None


class ProviderRouteDebugResponse(BaseModel):
    normalized_category: str
    provider: str
    model_key: str
    prompt_type: str | None
