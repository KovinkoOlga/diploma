from datetime import datetime, timezone

from sqlalchemy import select, update

from app.core.config import get_settings
from app.db.database import engine
from app.db.metadata import files, item_drafts
from app.modules.files.service import (
    create_image_file_with_variants,
    get_file_bytes,
)
from app.modules.ml_clients.catalog_client import CatalogGenerationError, generate_catalog_image
from app.modules.ml_clients.vision_client import analyze_item_image
from app.modules.wardrobe.image_processing import prepare_square_editor_assets
from app.modules.wardrobe.colors import normalize_color_ids
from app.modules.wardrobe.service import (
    PRIMARY_ATTRIBUTES_SUGGESTED_STATUS,
    PRIMARY_FAILED_STATUS,
    PRIMARY_PREPARING_STATUS,
    PRIMARY_READY_STATUS,
    apply_internal_draft_progress,
    get_selectable_color_palette,
    save_square_draft_artifacts,
)
from app.tasks.celery_app import celery_app, run_async_in_worker


CATALOG_NOT_REQUESTED_STATUS = "not_requested"
CATALOG_PROCESSING_STATUS = "processing"
CATALOG_READY_STATUS = "ready"
CATALOG_FAILED_STATUS = "failed"


async def _get_draft_row(draft_id: str) -> dict | None:
    async with engine.begin() as connection:
        row = (await connection.execute(select(item_drafts).where(item_drafts.c.id == draft_id))).mappings().first()
        return dict(row) if row else None


def _merge_ml_result(current: dict | None, key: str, value: dict) -> dict:
    merged = dict(current or {})
    merged[key] = {**(merged.get(key) or {}), **value}
    return merged


def _catalog_pipeline_error_metadata(
    *,
    category: str | None,
    subcategory_id: str | None,
    subcategory_name: str | None,
    color_ids: list[str],
    error_message: str,
    total_time_ms: int,
) -> dict:
    return {
        "category": category or "unknown",
        "subcategory_id": subcategory_id,
        "subcategory_name": subcategory_name,
        "color_ids": color_ids,
        "generation_status": "failed",
        "error_message": error_message,
        "timings_ms": {"total": total_time_ms},
    }


async def _file_name(file_id: str | None) -> str:
    if not file_id:
        return "image.png"
    async with engine.begin() as connection:
        filename = (
            await connection.execute(select(files.c.original_filename).where(files.c.id == file_id))
        ).scalar_one_or_none()
        return filename or "image.png"


def _apply_ml_predictions_to_payload(payload: dict, predictions: dict | None) -> dict:
    next_payload = dict(payload)
    prediction_map = dict(predictions or {})

    category_prediction = prediction_map.get("category")
    colors_prediction = prediction_map.get("colors") or {}

    next_payload["recognitionLabel"] = "ML analysis ready"
    if isinstance(category_prediction, dict):
        confidence = max(0.0, min(1.0, float(category_prediction.get("confidence") or 0.0)))
        next_payload["categoryId"] = category_prediction.get("categoryId") or next_payload.get("categoryId")
        next_payload["subcategory"] = category_prediction.get("subcategory") or next_payload.get("subcategory")
        next_payload["categoryPrediction"] = category_prediction
        next_payload["subcategorySuggestions"] = category_prediction.get("top3") or []
        next_payload["recognitionLabel"] = (
            f"Распознано: {next_payload.get('subcategory') or 'вещь'} ({round(confidence * 100)}%)"
        )

    color_ids = colors_prediction.get("color_ids") or []
    if color_ids:
        next_payload["colorIds"] = color_ids
    next_payload["colorPrediction"] = colors_prediction
    return next_payload


def _payload_color_ids(payload: dict) -> list[str]:
    raw_values = payload.get("colorIds")
    if isinstance(raw_values, list) and raw_values:
        return normalize_color_ids(str(value) for value in raw_values)

    prediction = payload.get("colorPrediction") or {}
    predicted_values = prediction.get("color_ids") if isinstance(prediction, dict) else []
    if isinstance(predicted_values, list):
        return normalize_color_ids(str(value) for value in predicted_values)
    return []


def _resolve_catalog_generation_context(payload: dict) -> dict[str, str | list[str] | None]:
    category_prediction = payload.get("categoryPrediction") if isinstance(payload.get("categoryPrediction"), dict) else {}
    category_hint = str(payload.get("categoryId") or category_prediction.get("categoryId") or "").strip() or None
    subcategory_name = (
        str(payload.get("subcategory") or payload.get("subcategoryName") or category_prediction.get("subcategory") or "").strip()
        or None
    )
    subcategory_id = str(payload.get("subcategoryId") or category_prediction.get("subcategoryId") or "").strip() or None
    color_ids = _payload_color_ids(payload)
    return {
        "category_hint": category_hint,
        "subcategory_id": subcategory_id,
        "subcategory_name": subcategory_name,
        "color_ids": color_ids,
    }


async def run_prepare_item_photo(draft_id: str) -> None:
    try:
        draft = await _get_draft_row(draft_id)
        if draft is None:
            return
        if draft["processing_status"] == PRIMARY_FAILED_STATUS:
            return
        if draft["processing_status"] == PRIMARY_READY_STATUS and draft.get("editor_file_id") and draft.get("processed_file_id") and draft.get("mask_file_id"):
            return
        if not draft.get("original_file_id"):
            async with engine.begin() as connection:
                await connection.execute(
                    update(item_drafts)
                    .where(item_drafts.c.id == draft_id)
                    .values(
                        processing_status=PRIMARY_FAILED_STATUS,
                        error_message="Original image is missing",
                        finished_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                )
            return

        async with engine.begin() as connection:
            await apply_internal_draft_progress(connection, draft_id, PRIMARY_PREPARING_STATUS)
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(started_at=draft.get("started_at") or datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc))
            )
            original_bytes = await get_file_bytes(connection, draft["original_file_id"], "original")
            color_palette = await get_selectable_color_palette(connection)

        if not original_bytes:
            async with engine.begin() as connection:
                await connection.execute(
                    update(item_drafts)
                    .where(item_drafts.c.id == draft_id)
                    .values(
                        processing_status=PRIMARY_FAILED_STATUS,
                        error_message="Original image bytes are unavailable",
                        finished_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                )
            return

        started = datetime.now(timezone.utc)
        filename = await _file_name(draft["original_file_id"])
        settings = get_settings()
        callback_base_url = settings.backend_internal_url.rstrip("/")
        result = await analyze_item_image(
            original_bytes,
            draft_id=draft_id,
            progress_callback_url=f"{callback_base_url}/internal/wardrobe/drafts/{draft_id}/progress",
            progress_token=settings.internal_service_token,
            filename=filename,
            color_palette=color_palette,
        )

        async with engine.begin() as connection:
            prepared_assets = prepare_square_editor_assets(
                original_bytes,
                result.mask_image,
                canvas_size=settings.wardrobe_image_canvas_size,
                padding_ratio=settings.wardrobe_image_padding_ratio,
                min_padding_px=settings.wardrobe_image_min_padding_px,
                alpha_threshold=settings.wardrobe_image_alpha_threshold,
            )
            saved_file_ids = await save_square_draft_artifacts(
                connection,
                draft["user_id"],
                draft_id,
                square_source_bytes=prepared_assets["square_source_bytes"],
                square_mask_bytes=prepared_assets["square_mask_bytes"],
                square_cutout_bytes=prepared_assets["square_cutout_bytes"],
            )

            payload = dict(draft.get("suggested_payload_json") or {})
            payload["primaryImageFileId"] = saved_file_ids["processed_file_id"]
            payload = _apply_ml_predictions_to_payload(
                payload,
                result.predictions if isinstance(result.predictions, dict) else {},
            )

            ml_result = _merge_ml_result(
                draft.get("ml_result_json"),
                "vision_pipeline",
                {
                    "predictions": result.predictions,
                    "timings_ms": result.timings_ms or {"total": int((datetime.now(timezone.utc) - started).total_seconds() * 1000)},
                    "mime_type": result.mime_type,
                },
            )

            await apply_internal_draft_progress(connection, draft_id, PRIMARY_ATTRIBUTES_SUGGESTED_STATUS)
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(
                    editor_file_id=saved_file_ids["editor_file_id"],
                    processed_file_id=saved_file_ids["processed_file_id"],
                    mask_file_id=saved_file_ids["mask_file_id"],
                    processing_status=PRIMARY_ATTRIBUTES_SUGGESTED_STATUS,
                    suggested_payload_json=payload,
                    ml_result_json=ml_result,
                    updated_at=datetime.now(timezone.utc),
                )
            )
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(
                    processing_status=PRIMARY_READY_STATUS,
                    finished_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
            )
    except Exception as exc:
        async with engine.begin() as connection:
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(
                    processing_status=PRIMARY_FAILED_STATUS,
                    error_message=str(exc),
                    finished_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
            )
        return


async def run_enhance_catalog_photo(draft_id: str) -> None:
    draft: dict | None = None
    started: datetime | None = None
    try:
        draft = await _get_draft_row(draft_id)
        if draft is None:
            return
        if draft["processing_status"] != PRIMARY_READY_STATUS:
            raise ValueError("Draft is not ready")

        async with engine.begin() as connection:
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(
                    catalog_processing_status=CATALOG_PROCESSING_STATUS,
                    catalog_error_message=None,
                    updated_at=datetime.now(timezone.utc),
                )
            )
            source_file_id = draft.get("editor_file_id") or draft["original_file_id"]
            original_bytes = await get_file_bytes(connection, source_file_id, "original")
            cutout_bytes = await get_file_bytes(connection, draft["processed_file_id"], "cutout")
            mask_bytes = await get_file_bytes(connection, draft["mask_file_id"], "mask")

        if not original_bytes or not cutout_bytes or not mask_bytes:
            async with engine.begin() as connection:
                await connection.execute(
                    update(item_drafts)
                    .where(item_drafts.c.id == draft_id)
                    .values(
                        catalog_processing_status=CATALOG_FAILED_STATUS,
                        catalog_error_message="Required ML input variants are unavailable",
                        updated_at=datetime.now(timezone.utc),
                    )
                )
            return

        started = datetime.now(timezone.utc)
        filename = await _file_name(draft["original_file_id"])
        payload = dict(draft.get("suggested_payload_json") or {})
        generation_context = _resolve_catalog_generation_context(payload)
        result = await generate_catalog_image(
            original_bytes,
            cutout_bytes,
            mask_bytes,
            filename=filename,
            category_hint=generation_context["category_hint"],
            subcategory_id=generation_context["subcategory_id"],
            subcategory_name=generation_context["subcategory_name"],
            color_ids=generation_context["color_ids"],
        )

        async with engine.begin() as connection:
            catalog_file_id = await create_image_file_with_variants(
                connection,
                draft["user_id"],
                {"catalog": result.catalog_image, "card": result.catalog_image, "thumbnail": result.catalog_image},
                f"catalog-{filename}",
                result.mime_type,
            )
            updated_payload = dict(payload)
            if updated_payload.get("primaryImageFileId") == draft.get("catalog_file_id"):
                updated_payload["primaryImageFileId"] = catalog_file_id
                updated_payload.pop("image", None)
            ml_result = _merge_ml_result(
                draft.get("ml_result_json"),
                "catalog_pipeline",
                {
                    "provider": result.provider,
                    "model_used": result.model_used,
                    "category": result.category,
                    "subcategory_id": result.subcategory_id,
                    "subcategory_name": result.subcategory_name,
                    "subcategory_prompt_text": result.subcategory_prompt_text,
                    "color_ids": result.color_ids,
                    "color_prompt_text": result.color_prompt_text,
                    "generation_status": result.generation_status,
                    "fallback_used": result.fallback_used,
                    "deterministic": result.deterministic,
                    "seed": result.seed,
                    "ip_adapter_weight_name": result.debug.get("ip_adapter_weight_name") if isinstance(result.debug, dict) else None,
                    "ip_adapter_scale": result.debug.get("ip_adapter_scale") if isinstance(result.debug, dict) else None,
                    "mask_mode": result.debug.get("mask_mode") if isinstance(result.debug, dict) else None,
                    "mask_expand_px": result.debug.get("mask_expand_px") if isinstance(result.debug, dict) else None,
                    "mask_blur_px": result.debug.get("mask_blur_px") if isinstance(result.debug, dict) else None,
                    "strength": result.debug.get("strength") if isinstance(result.debug, dict) else None,
                    "guidance_scale": result.debug.get("guidance_scale") if isinstance(result.debug, dict) else None,
                    "num_inference_steps": result.debug.get("num_inference_steps") if isinstance(result.debug, dict) else None,
                    "transparent_background": result.debug.get("transparent_background") if isinstance(result.debug, dict) else None,
                    "result_margin_ratio": result.debug.get("result_margin_ratio") if isinstance(result.debug, dict) else None,
                    "debug": result.debug,
                    "timings_ms": {"total": int((datetime.now(timezone.utc) - started).total_seconds() * 1000)},
                },
            )
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(
                    catalog_file_id=catalog_file_id,
                    catalog_processing_status=CATALOG_READY_STATUS,
                    catalog_error_message=None,
                    suggested_payload_json=updated_payload,
                    ml_result_json=ml_result,
                    updated_at=datetime.now(timezone.utc),
                )
            )
    except CatalogGenerationError as exc:
        payload = dict((draft or {}).get("suggested_payload_json") or {})
        generation_context = _resolve_catalog_generation_context(payload)
        total_time_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000) if started else 0
        async with engine.begin() as connection:
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(
                    catalog_processing_status=CATALOG_FAILED_STATUS,
                    catalog_error_message=str(exc),
                    ml_result_json=_merge_ml_result(
                        draft.get("ml_result_json") if draft else None,
                        "catalog_pipeline",
                        _catalog_pipeline_error_metadata(
                            category=generation_context["category_hint"],
                            subcategory_id=generation_context["subcategory_id"],
                            subcategory_name=generation_context["subcategory_name"],
                            color_ids=list(generation_context["color_ids"] or []),
                            error_message=str(exc),
                            total_time_ms=total_time_ms,
                        ),
                    ),
                    updated_at=datetime.now(timezone.utc),
                )
            )
    except Exception as exc:
        payload = dict((draft or {}).get("suggested_payload_json") or {})
        generation_context = _resolve_catalog_generation_context(payload)
        total_time_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000) if started else 0
        async with engine.begin() as connection:
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(
                    catalog_processing_status=CATALOG_FAILED_STATUS,
                    catalog_error_message=str(exc),
                    ml_result_json=_merge_ml_result(
                        draft.get("ml_result_json") if draft else None,
                        "catalog_pipeline",
                        _catalog_pipeline_error_metadata(
                            category=generation_context["category_hint"],
                            subcategory_id=generation_context["subcategory_id"],
                            subcategory_name=generation_context["subcategory_name"],
                            color_ids=list(generation_context["color_ids"] or []),
                            error_message=str(exc),
                            total_time_ms=total_time_ms,
                        ),
                    ),
                    updated_at=datetime.now(timezone.utc),
                )
            )
        return


@celery_app.task(name="prepare_item_photo_task")
def prepare_item_photo_task(draft_id: str) -> None:
    run_async_in_worker(run_prepare_item_photo(draft_id))


@celery_app.task(name="enhance_catalog_photo_task")
def enhance_catalog_photo_task(draft_id: str) -> None:
    run_async_in_worker(run_enhance_catalog_photo(draft_id))


async def trigger_prepare_item_photo_task(draft_id: str) -> None:
    if get_settings().celery_task_always_eager:
        await run_prepare_item_photo(draft_id)
        return
    prepare_item_photo_task.delay(draft_id)


async def trigger_enhance_catalog_photo_task(draft_id: str) -> None:
    if get_settings().celery_task_always_eager:
        await run_enhance_catalog_photo(draft_id)
        return
    enhance_catalog_photo_task.delay(draft_id)
