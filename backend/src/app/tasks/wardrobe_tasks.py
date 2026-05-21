from datetime import datetime, timezone

from sqlalchemy import select, update

from app.core.config import get_settings
from app.db.database import engine
from app.db.metadata import files, item_drafts
from app.modules.files.service import (
    create_image_file_with_variants,
    get_file_bytes,
    transparent_cutout_variants,
)
from app.modules.ml_clients.vision_client import analyze_item_image
from app.modules.ml_clients.catalog_client import generate_catalog_image
from app.modules.wardrobe.service import get_selectable_color_palette
from app.tasks.celery_app import celery_app, run_async_in_worker


PRIMARY_READY_STATUS = "ready"
PRIMARY_FAILED_STATUS = "failed"
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


async def run_prepare_item_photo(draft_id: str) -> None:
    try:
        draft = await _get_draft_row(draft_id)
        if draft is None:
            return
        if draft["processing_status"] == PRIMARY_READY_STATUS and draft.get("processed_file_id") and draft.get("mask_file_id"):
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
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(
                    processing_status="background_removing",
                    error_message=None,
                    started_at=draft.get("started_at") or datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
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
        result = await analyze_item_image(original_bytes, filename=filename, color_palette=color_palette)

        async with engine.begin() as connection:
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(processing_status="category_recognizing", updated_at=datetime.now(timezone.utc))
            )
            cutout_file_id = draft.get("processed_file_id") or await create_image_file_with_variants(
                connection,
                draft["user_id"],
                transparent_cutout_variants(result.cutout_image),
                f"cutout-{filename}",
                result.mime_type,
            )
            mask_file_id = draft.get("mask_file_id") or await create_image_file_with_variants(
                connection,
                draft["user_id"],
                {"mask": result.mask_image, "card": result.mask_image, "thumbnail": result.mask_image},
                f"mask-{filename}",
                result.mime_type,
            )

            payload = dict(draft.get("suggested_payload_json") or {})
            payload["primaryImageFileId"] = cutout_file_id
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

            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(processing_status="colors_extracting", updated_at=datetime.now(timezone.utc))
            )
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(
                    processed_file_id=cutout_file_id,
                    mask_file_id=mask_file_id,
                    processing_status="attributes_suggested",
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
    try:
        draft = await _get_draft_row(draft_id)
        if draft is None:
            return
        if draft["processing_status"] != PRIMARY_READY_STATUS:
            raise ValueError("Draft is not ready")
        if draft.get("catalog_processing_status") == CATALOG_READY_STATUS and draft.get("catalog_file_id"):
            return

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
            original_bytes = await get_file_bytes(connection, draft["original_file_id"], "original")
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
        result = await generate_catalog_image(
            original_bytes,
            cutout_bytes,
            mask_bytes,
            filename=filename,
            category_hint=payload.get("categoryId"),
        )

        async with engine.begin() as connection:
            catalog_file_id = draft.get("catalog_file_id") or await create_image_file_with_variants(
                connection,
                draft["user_id"],
                {"catalog": result.catalog_image, "card": result.catalog_image, "thumbnail": result.catalog_image},
                f"catalog-{filename}",
                result.mime_type,
            )
            ml_result = _merge_ml_result(
                draft.get("ml_result_json"),
                "catalog_pipeline",
                {
                    "model_used": result.model_used,
                    "fallback_used": result.fallback_used,
                    "timings_ms": int((datetime.now(timezone.utc) - started).total_seconds() * 1000),
                },
            )
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(
                    catalog_file_id=catalog_file_id,
                    catalog_processing_status=CATALOG_READY_STATUS,
                    ml_result_json=ml_result,
                    updated_at=datetime.now(timezone.utc),
                )
            )
    except Exception as exc:
        async with engine.begin() as connection:
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(
                    catalog_processing_status=CATALOG_FAILED_STATUS,
                    catalog_error_message=str(exc),
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
