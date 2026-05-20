from functools import lru_cache
import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import get_settings
from app.schemas.analysis import AnalyzeItemImageResponse, ColorPaletteEntry
from app.services.background_removal_service import BackgroundRemovalService
from app.services.category_prediction_service import CategoryPredictionService
from app.services.color_prediction_service import ColorPredictionService
from app.services.image_analysis_service import ImageAnalysisService


router = APIRouter()


@lru_cache
def get_image_analysis_service() -> ImageAnalysisService:
    return ImageAnalysisService(
        background_removal_service=BackgroundRemovalService(),
        category_prediction_service=CategoryPredictionService(),
        color_prediction_service=ColorPredictionService(),
    )


@router.get("/health")
async def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "model_path": settings.bg_model_path,
        "stub_enabled": settings.bg_enable_stub,
        "img_size": settings.bg_img_size,
        "threshold": settings.bg_threshold,
        "low_threshold": settings.bg_low_threshold,
        "high_threshold": settings.bg_high_threshold,
        "min_area": settings.bg_min_area,
    }


@router.post("/v1/analyze-item-image", response_model=AnalyzeItemImageResponse)
async def analyze_item_image(image: UploadFile = File(...), palette_json: str = Form("[]")) -> AnalyzeItemImageResponse:
    content = await image.read()
    try:
        raw_palette = json.loads(palette_json or "[]")
        if not isinstance(raw_palette, list):
            raise ValueError("palette_json must be a JSON array")
        palette = [ColorPaletteEntry.model_validate(entry) for entry in raw_palette]
    except (json.JSONDecodeError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid palette_json: {exc}")
    return get_image_analysis_service().analyze_item_image(content, color_palette=palette)

