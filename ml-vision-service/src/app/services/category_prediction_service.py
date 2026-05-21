from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
from PIL import Image

from app.core.config import get_settings
from app.schemas.analysis import (
    CategoryHeadDebug,
    CategoryPredictionDebug,
    CategoryPredictionResponse,
    CategoryPredictionSuggestion,
)
from app.utils.classifier_taxonomy import (
    ClassifierConfigurationError,
    ClassifierTaxonomy,
    extract_top_k,
)
from app.utils.image_io import load_rgb_image


logger = logging.getLogger(__name__)


class CategoryPredictionService:
    def __init__(self) -> None:
        self._model = None
        self._model_name = "stub"
        self._taxonomy: ClassifierTaxonomy | None = None

    def _load_taxonomy(self) -> ClassifierTaxonomy | None:
        settings = get_settings()
        if self._taxonomy is not None:
            return self._taxonomy

        artifacts_dir = Path(settings.classifier_artifacts_dir)
        if not artifacts_dir.exists():
            if settings.classifier_enable_stub:
                return None
            raise ClassifierConfigurationError(f"Classifier artifacts directory not found: {artifacts_dir}")

        self._taxonomy = ClassifierTaxonomy.from_artifacts(artifacts_dir)
        return self._taxonomy

    def _load_model(self):
        settings = get_settings()
        if self._model is not None:
            return self._model

        model_path = Path(settings.classifier_model_path)
        if not model_path.exists():
            if settings.classifier_enable_stub:
                return None
            raise ClassifierConfigurationError(f"Classifier model not found: {model_path}")

        try:
            import tensorflow as tf
        except ModuleNotFoundError as exc:
            raise ClassifierConfigurationError("TensorFlow is required for classifier inference") from exc

        self._model = tf.keras.models.load_model(model_path, compile=False)
        self._model_name = model_path.name
        return self._model

    def _prepare_image(self, image_bytes: bytes) -> np.ndarray:
        settings = get_settings()
        image = load_rgb_image(image_bytes)
        resized = image.resize(
            (settings.classifier_img_size, settings.classifier_img_size),
            Image.Resampling.BILINEAR,
        )
        return np.asarray(resized, dtype=np.float32)

    def _prediction_outputs(self, raw_outputs) -> tuple[np.ndarray | None, np.ndarray | None]:
        model = self._model
        output_names = list(getattr(model, "output_names", []) or [])

        if isinstance(raw_outputs, dict):
            subcategory_probs = raw_outputs.get("subcategory")
            category_probs = raw_outputs.get("category")
        elif isinstance(raw_outputs, (list, tuple)):
            outputs_by_name = {
                output_names[index]: value
                for index, value in enumerate(raw_outputs[: len(output_names)])
            }
            subcategory_probs = outputs_by_name.get("subcategory")
            category_probs = outputs_by_name.get("category")
            if subcategory_probs is None and raw_outputs:
                subcategory_probs = raw_outputs[0]
            if category_probs is None and len(raw_outputs) > 1:
                category_probs = raw_outputs[1]
        else:
            subcategory_probs = raw_outputs
            category_probs = None

        subcategory_array = np.asarray(subcategory_probs, dtype=np.float32).reshape(-1) if subcategory_probs is not None else None
        category_array = np.asarray(category_probs, dtype=np.float32).reshape(-1) if category_probs is not None else None
        return subcategory_array, category_array

    def predict(self, image_bytes: bytes) -> CategoryPredictionResponse | None:
        try:
            taxonomy = self._load_taxonomy()
            model = self._load_model()
            if taxonomy is None or model is None:
                return None

            batch = np.expand_dims(self._prepare_image(image_bytes), axis=0)
            subcategory_probs, category_probs = self._prediction_outputs(model.predict(batch, verbose=0))
            if subcategory_probs is None or not len(subcategory_probs):
                raise ValueError("Classifier returned empty subcategory predictions")
            if len(subcategory_probs) != len(taxonomy.subcategories_by_index):
                raise ValueError(
                    f"Unexpected subcategory output size: {len(subcategory_probs)} != {len(taxonomy.subcategories_by_index)}"
                )
            if category_probs is not None and len(category_probs) != len(taxonomy.categories_by_index):
                raise ValueError(
                    f"Unexpected category output size: {len(category_probs)} != {len(taxonomy.categories_by_index)}"
                )

            top_k_items = extract_top_k(subcategory_probs.tolist(), get_settings().classifier_top_k)
            if not top_k_items:
                return None

            top_suggestions = [
                taxonomy.build_suggestion(subcategory_index=index, confidence=confidence, rank=rank)
                for rank, (index, confidence) in enumerate(top_k_items, start=1)
            ]
            top1 = top_suggestions[0]
            if top1.confidence < float(get_settings().classifier_min_confidence):
                return None

            top3 = [
                CategoryPredictionSuggestion(
                    rank=item.rank,
                    categoryId=item.category_id,
                    categoryTitle=item.category_title,
                    subcategoryId=item.subcategory_id,
                    subcategory=item.display_name,
                    subcategoryKey=item.raw_subcategory,
                    confidence=item.confidence,
                )
                for item in top_suggestions
            ]

            category_head = None
            if category_probs is not None and len(category_probs):
                category_index = int(np.argmax(category_probs))
                if 0 <= category_index < len(taxonomy.categories_by_index):
                    category_descriptor = taxonomy.categories_by_index[category_index]
                    category_head = CategoryHeadDebug(
                        categoryKey=category_descriptor.raw_label,
                        categoryTitle=category_descriptor.title,
                        confidence=float(category_probs[category_index]),
                    )

            return CategoryPredictionResponse(
                rank=1,
                categoryId=top1.category_id,
                categoryTitle=top1.category_title,
                subcategoryId=top1.subcategory_id,
                subcategory=top1.display_name,
                subcategoryKey=top1.raw_subcategory,
                confidence=top1.confidence,
                top3=top3,
                modelName=self._model_name,
                debug=CategoryPredictionDebug(
                    rawCategory=top1.raw_category,
                    rawSubcategory=top1.raw_subcategory,
                    categoryHead=category_head,
                    warnings=list(taxonomy.warnings),
                ),
            )
        except ClassifierConfigurationError:
            raise
        except Exception as exc:
            logger.warning("Category prediction failed: %s", exc, exc_info=True)
            return None
