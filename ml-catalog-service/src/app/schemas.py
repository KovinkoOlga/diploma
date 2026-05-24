from typing import Any, Literal

from pydantic import BaseModel, Field


class CatalogGenerationResponse(BaseModel):
    catalog_image: str | None = None
    mime_type: str | None = None
    provider: str
    model_used: str
    category: str
    subcategory_id: str | None = None
    subcategory_name: str | None = None
    subcategory_prompt_text: str | None = None
    color_ids: list[str] = Field(default_factory=list)
    color_prompt_text: str | None = None
    deterministic: bool | None = None
    seed: int | None = None
    generation_status: Literal["ready", "failed"]
    error_message: str | None = None
    fallback_used: bool = False
    debug: dict[str, Any] | None = None
