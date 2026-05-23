from functools import lru_cache
import json
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import get_settings
from app.schemas.analysis import AnalyzeItemImageResponse, ColorPaletteEntry
from app.services.background_removal_service import BackgroundRemovalService
from app.services.category_prediction_service import CategoryPredictionService
from app.services.color_prediction_service import ColorPredictionService
from app.services.image_analysis_service import ImageAnalysisService
from app.utils.classifier_taxonomy import ClassifierConfigurationError


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
    classifier_model_path = Path(settings.classifier_model_path)
    classifier_artifacts_dir = Path(settings.classifier_artifacts_dir)
    return {
        "status": "ok",
        "model_path": settings.bg_model_path,
        "stub_enabled": settings.bg_enable_stub,
        "img_size": settings.bg_img_size,
        "threshold": settings.bg_threshold,
        "low_threshold": settings.bg_low_threshold,
        "high_threshold": settings.bg_high_threshold,
        "min_area": settings.bg_min_area,
        "classifier_model_path": settings.classifier_model_path,
        "classifier_artifacts_dir": settings.classifier_artifacts_dir,
        "classifier_stub_enabled": settings.classifier_enable_stub,
        "classifier_img_size": settings.classifier_img_size,
        "classifier_top_k": settings.classifier_top_k,
        "classifier_min_confidence": settings.classifier_min_confidence,
        "classifier_use_cutout": settings.classifier_use_cutout,
        "classifier_model_exists": classifier_model_path.exists(),
        "classifier_artifacts_dir_exists": classifier_artifacts_dir.exists(),
        "classifier_taxonomy_exists": (classifier_artifacts_dir / "taxonomy.csv").exists(),
    }


@router.post("/v1/analyze-item-image", response_model=AnalyzeItemImageResponse)
async def analyze_item_image(
    image: UploadFile = File(...),
    draft_id: str = Form(...),
    progress_callback_url: str = Form(...),
    progress_token: str = Form(...),
    palette_json: str = Form("[]"),
) -> AnalyzeItemImageResponse:
    content = await image.read()
    try:
        raw_palette = json.loads(palette_json or "[]")
        if not isinstance(raw_palette, list):
            raise ValueError("palette_json must be a JSON array")
        palette = [ColorPaletteEntry.model_validate(entry) for entry in raw_palette]
    except (json.JSONDecodeError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid palette_json: {exc}")
    try:
        return get_image_analysis_service().analyze_item_image(
            content,
            draft_id=draft_id,
            progress_callback_url=progress_callback_url,
            progress_token=progress_token,
            color_palette=palette,
        )
    except ClassifierConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
