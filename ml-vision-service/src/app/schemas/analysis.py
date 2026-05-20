from typing import Any

from pydantic import BaseModel, ConfigDict


class ItemImagePredictions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: Any | None = None
    colors: Any | None = None


class AnalysisTimingsMs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    background: int
    category: int
    colors: int
    total: int


class AnalyzeItemImageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cutout_image: str
    mask_image: str
    mime_type: str
    predictions: ItemImagePredictions
    timings_ms: AnalysisTimingsMs
