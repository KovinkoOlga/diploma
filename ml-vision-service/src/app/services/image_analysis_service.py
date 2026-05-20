from __future__ import annotations

from time import perf_counter

from app.schemas.analysis import AnalysisTimingsMs, AnalyzeItemImageResponse, ItemImagePredictions
from app.services.background_removal_service import BackgroundRemovalService
from app.services.category_prediction_service import CategoryPredictionService
from app.services.color_prediction_service import ColorPredictionService
from app.utils.image_io import image_bytes_to_base64


class ImageAnalysisService:
    def __init__(
        self,
        *,
        background_removal_service: BackgroundRemovalService,
        category_prediction_service: CategoryPredictionService,
        color_prediction_service: ColorPredictionService,
    ) -> None:
        self._background_removal_service = background_removal_service
        self._category_prediction_service = category_prediction_service
        self._color_prediction_service = color_prediction_service

    def analyze_item_image(self, image_bytes: bytes) -> AnalyzeItemImageResponse:
        total_started = perf_counter()

        background_started = perf_counter()
        background_result = self._background_removal_service.remove_background(image_bytes)
        background_ms = int((perf_counter() - background_started) * 1000)

        category_started = perf_counter()
        category_prediction = self._category_prediction_service.predict(image_bytes)
        category_ms = int((perf_counter() - category_started) * 1000)

        colors_started = perf_counter()
        colors_prediction = self._color_prediction_service.predict(image_bytes)
        colors_ms = int((perf_counter() - colors_started) * 1000)

        total_ms = int((perf_counter() - total_started) * 1000)
        return AnalyzeItemImageResponse(
            cutout_image=image_bytes_to_base64(background_result.cutout_image),
            mask_image=image_bytes_to_base64(background_result.mask_image),
            mime_type=background_result.mime_type,
            predictions=ItemImagePredictions(
                category=category_prediction,
                colors=colors_prediction,
            ),
            timings_ms=AnalysisTimingsMs(
                background=background_ms,
                category=category_ms,
                colors=colors_ms,
                total=total_ms,
            ),
        )
