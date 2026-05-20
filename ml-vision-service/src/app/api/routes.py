from functools import lru_cache

from fastapi import APIRouter, File, UploadFile

from app.core.config import get_settings
from app.schemas.analysis import AnalyzeItemImageResponse
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
async def analyze_item_image(image: UploadFile = File(...)) -> AnalyzeItemImageResponse:
    content = await image.read()
    return get_image_analysis_service().analyze_item_image(content)


@router.post("/v1/remove-background", deprecated=True)
async def remove_background(image: UploadFile = File(...)) -> dict:
    content = await image.read()
    analysis = get_image_analysis_service().analyze_item_image(content)
    return {
        "cutout_image": analysis.cutout_image,
        "mask_image": analysis.mask_image,
        "mime_type": analysis.mime_type,
        "category_prediction": analysis.predictions.category,
        "timings_ms": analysis.timings_ms.model_dump(),
    }
