from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ColorPaletteEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    parent_color_id: str | None = None
    parent_name: str | None = None
    hex: str
    kind: str
    sort_order: int = 0


class ColorPredictionItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    parent_color_id: str | None = None
    parent_name: str | None = None
    hex: str
    kind: str
    coverage_percent: float
    confidence: float
    distance: float | None = None


class ColorPredictionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    color_ids: list[str] = Field(default_factory=list)
    colors: list[ColorPredictionItem] = Field(default_factory=list)
    strategy: str
    is_multicolor: bool = False
    confidence: float
    debug: dict[str, Any] | None = None


class CategoryHeadDebug(BaseModel):
    model_config = ConfigDict(extra="forbid")

    categoryKey: str
    categoryTitle: str
    confidence: float


class CategoryPredictionDebug(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rawCategory: str
    rawSubcategory: str
    categoryHead: CategoryHeadDebug | None = None
    warnings: list[str] = Field(default_factory=list)


class CategoryPredictionSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rank: int
    categoryId: str
    categoryTitle: str
    subcategoryId: str
    subcategory: str
    subcategoryKey: str
    confidence: float


class CategoryPredictionResponse(CategoryPredictionSuggestion):
    model_config = ConfigDict(extra="forbid")

    top3: list[CategoryPredictionSuggestion] = Field(default_factory=list)
    modelName: str
    debug: CategoryPredictionDebug


class ItemImagePredictions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: CategoryPredictionResponse | None = None
    colors: ColorPredictionResponse | None = None


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
