import base64
import json
from datetime import datetime, timezone
from io import BytesIO

from sqlalchemy import delete, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncConnection
from PIL import Image, ImageDraw, ImageOps

from app.db.metadata import (
    brands,
    categories,
    colors,
    item_colors,
    item_drafts,
    item_seasons,
    item_statuses,
    item_styles,
    outfit_items,
    seasons,
    sizes,
    styles,
    subcategories,
    wardrobe_catalogs,
    wardrobe_item_templates,
    wardrobe_items,
)
from app.modules.files.service import (
    create_image_file_with_variants,
    get_file_bytes,
    get_file_url,
    new_id,
    transparent_cutout_variants,
)
from app.modules.wardrobe.schemas import (
    BootstrapResponse,
    CatalogResponse,
    CategoryResponse,
    DraftImageAsset,
    DraftImagesResponse,
    DraftResponse,
    ItemPatch,
    ItemPayload,
    ItemResponse,
    StatusResponse,
    TemplateResponse,
)


PRIMARY_READY_STATUS = "ready"
PRIMARY_FAILED_STATUS = "failed"
CATALOG_NOT_REQUESTED_STATUS = "not_requested"
CATALOG_QUEUED_STATUS = "queued"
CATALOG_PROCESSING_STATUS = "processing"
CATALOG_READY_STATUS = "ready"
CATALOG_FAILED_STATUS = "failed"
VALID_MASK_ROTATIONS = {0, 90, 180, 270}
MASK_EDITOR_MAX_SIZE = 1024


def normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().replace("С‘", "Рµ").split())


def _csv(values: list[str] | None) -> list[str]:
    return [value for value in (values or []) if value]


async def get_bootstrap(connection: AsyncConnection, user_id: str) -> BootstrapResponse:
    catalog_rows = (
        await connection.execute(
            select(wardrobe_catalogs).where(wardrobe_catalogs.c.user_id == user_id).order_by(wardrobe_catalogs.c.sort_order)
        )
    ).mappings().all()
    category_rows = (await connection.execute(select(categories).order_by(categories.c.sort_order))).mappings().all()
    subcategory_rows = (
        await connection.execute(
            select(subcategories).where(or_(subcategories.c.user_id == user_id, subcategories.c.user_id.is_(None)))
        )
    ).mappings().all()
    subcategories_by_category: dict[str, list[str]] = {}
    for row in subcategory_rows:
        subcategories_by_category.setdefault(row["category_id"], []).append(row["name"])

    status_rows = (await connection.execute(select(item_statuses).order_by(item_statuses.c.sort_order))).mappings().all()
    color_rows = (await connection.execute(select(colors.c.name).order_by(colors.c.name))).scalars().all()
    season_rows = (await connection.execute(select(seasons.c.name).order_by(seasons.c.sort_order))).scalars().all()
    size_rows = (await connection.execute(select(sizes.c.name).order_by(sizes.c.id))).scalars().all()
    style_rows = (
        await connection.execute(select(styles.c.name).where(styles.c.is_system.is_(True)).order_by(styles.c.name))
    ).scalars().all()
    template_rows = (
        await connection.execute(select(wardrobe_item_templates).order_by(wardrobe_item_templates.c.sort_order))
    ).mappings().all()

    return BootstrapResponse(
        catalogs=[
            CatalogResponse(
                id=row["id"],
                title=row["name"],
                sortOrder=row["sort_order"],
                isDefault=row["is_default"],
            )
            for row in catalog_rows
        ],
        categories=[
            CategoryResponse(
                id=row["id"],
                title=row["name"],
                icon=row["icon_key"],
                subcategories=sorted(set(subcategories_by_category.get(row["id"], []))),
            )
            for row in category_rows
        ],
        colors=list(color_rows),
        seasons=list(season_rows),
        sizes=list(size_rows),
        styles=list(style_rows),
        statuses=[StatusResponse(id=row["code"], title=row["name"]) for row in status_rows],
        templates=[
            TemplateResponse(
                id=row["id"],
                title=row["name"],
                categoryId=row["category_id"],
                subcategory=row["subcategory_name"],
                brand=row["brand"] or "",
                size=row["size_name"] or "",
                material=row["material"] or "",
                colors=row["colors_json"] or [],
                seasons=row["seasons_json"] or [],
                styles=row["styles_json"] or [],
            )
            for row in template_rows
        ],
    )


async def create_catalog(connection: AsyncConnection, user_id: str, title: str) -> CatalogResponse:
    count = (
        await connection.execute(
            select(func.count()).select_from(wardrobe_catalogs).where(wardrobe_catalogs.c.user_id == user_id)
        )
    ).scalar_one()
    row = {
        "id": new_id("catalog"),
        "user_id": user_id,
        "name": title.strip(),
        "sort_order": (count + 1) * 10,
        "is_default": False,
    }
    await connection.execute(insert(wardrobe_catalogs).values(row))
    return CatalogResponse(id=row["id"], title=row["name"], sortOrder=row["sort_order"], isDefault=False)


async def update_catalog(connection: AsyncConnection, user_id: str, catalog_id: str, title: str) -> CatalogResponse:
    result = await connection.execute(
        update(wardrobe_catalogs)
        .where(wardrobe_catalogs.c.id == catalog_id, wardrobe_catalogs.c.user_id == user_id)
        .values(name=title.strip())
        .returning(wardrobe_catalogs)
    )
    row = result.mappings().first()
    if row is None:
        raise LookupError("Catalog not found")
    return CatalogResponse(id=row["id"], title=row["name"], sortOrder=row["sort_order"], isDefault=row["is_default"])


async def _status_id(connection: AsyncConnection, code: str) -> str:
    row = (await connection.execute(select(item_statuses.c.id).where(item_statuses.c.code == code))).first()
    if row is None:
        raise ValueError(f"Unknown status: {code}")
    return row[0]


async def _ensure_brand(connection: AsyncConnection, user_id: str, name: str) -> str | None:
    name = name.strip()
    if not name:
        return None
    normalized = normalize_name(name)
    row = (
        await connection.execute(select(brands.c.id).where(brands.c.user_id == user_id, brands.c.normalized_name == normalized))
    ).first()
    if row:
        return row[0]
    brand_id = new_id("brand")
    await connection.execute(insert(brands).values(id=brand_id, user_id=user_id, name=name, normalized_name=normalized))
    return brand_id


async def _size_id(connection: AsyncConnection, name: str) -> str | None:
    name = name.strip()
    if not name:
        return None
    row = (await connection.execute(select(sizes.c.id).where(sizes.c.name == name))).first()
    return row[0] if row else None


async def _ensure_subcategory(connection: AsyncConnection, user_id: str, category_id: str, name: str) -> str | None:
    name = name.strip()
    if not name:
        return None
    normalized = normalize_name(name)
    row = (
        await connection.execute(
            select(subcategories.c.id).where(
                subcategories.c.category_id == category_id,
                subcategories.c.normalized_name == normalized,
                or_(subcategories.c.user_id == user_id, subcategories.c.user_id.is_(None)),
            )
        )
    ).first()
    if row:
        return row[0]
    subcategory_id = new_id("subcategory")
    await connection.execute(
        insert(subcategories).values(
            id=subcategory_id,
            category_id=category_id,
            user_id=user_id,
            name=name,
            normalized_name=normalized,
            is_system=False,
        )
    )
    return subcategory_id


async def _ids_by_names(connection: AsyncConnection, table, names: list[str]) -> list[str]:
    if not names:
        return []
    rows = (await connection.execute(select(table.c.id, table.c.name).where(table.c.name.in_(names)))).mappings().all()
    return [row["id"] for row in rows]


async def _style_ids_by_names(connection: AsyncConnection, names: list[str]) -> list[str]:
    if not names:
        return []
    rows = (await connection.execute(select(styles.c.id, styles.c.name).where(styles.c.name.in_(names)))).mappings().all()
    return [row["id"] for row in rows]


async def _replace_item_links(
    connection: AsyncConnection,
    item_id: str,
    color_names: list[str],
    season_names: list[str],
    style_names: list[str],
) -> None:
    await connection.execute(delete(item_colors).where(item_colors.c.item_id == item_id))
    await connection.execute(delete(item_seasons).where(item_seasons.c.item_id == item_id))
    await connection.execute(delete(item_styles).where(item_styles.c.item_id == item_id))

    color_ids = await _ids_by_names(connection, colors, color_names)
    season_ids = await _ids_by_names(connection, seasons, season_names)
    style_ids = await _style_ids_by_names(connection, style_names)

    if color_ids:
        await connection.execute(
            insert(item_colors),
            [{"id": new_id("item_color"), "item_id": item_id, "color_id": color_id} for color_id in color_ids],
        )
    if season_ids:
        await connection.execute(
            insert(item_seasons),
            [{"id": new_id("item_season"), "item_id": item_id, "season_id": season_id} for season_id in season_ids],
        )
    if style_ids:
        await connection.execute(
            insert(item_styles),
            [{"id": new_id("item_style"), "item_id": item_id, "style_id": style_id} for style_id in style_ids],
        )


async def _item_link_names(connection: AsyncConnection, item_id: str) -> tuple[list[str], list[str], list[str]]:
    color_rows = (
        await connection.execute(
            select(colors.c.name)
            .select_from(item_colors.join(colors, item_colors.c.color_id == colors.c.id))
            .where(item_colors.c.item_id == item_id)
        )
    ).scalars().all()
    season_rows = (
        await connection.execute(
            select(seasons.c.name)
            .select_from(item_seasons.join(seasons, item_seasons.c.season_id == seasons.c.id))
            .where(item_seasons.c.item_id == item_id)
        )
    ).scalars().all()
    style_rows = (
        await connection.execute(
            select(styles.c.name)
            .select_from(item_styles.join(styles, item_styles.c.style_id == styles.c.id))
            .where(item_styles.c.item_id == item_id)
        )
    ).scalars().all()
    return list(color_rows), list(season_rows), list(style_rows)


async def serialize_item(connection: AsyncConnection, row: dict) -> ItemResponse:
    color_names, season_names, style_names = await _item_link_names(connection, row["id"])
    outfit_count = (
        await connection.execute(select(func.count()).select_from(outfit_items).where(outfit_items.c.item_id == row["id"]))
    ).scalar_one()
    image_url = await get_file_url(connection, row.get("primary_image_file_id"), "card")
    created_at = row["created_at"]
    created = created_at.date().isoformat() if isinstance(created_at, datetime) else str(created_at)
    material = (row.get("attributes_json") or {}).get("material", "")
    status = row["status_code"]
    return ItemResponse(
        id=row["id"],
        title=row["name"],
        catalogId=row["catalog_id"],
        categoryId=row["category_id"],
        subcategory=row.get("subcategory_name") or "",
        colors=color_names,
        color=color_names[0] if color_names else "",
        brand=row.get("brand_name") or "",
        size=row.get("size_name") or "",
        material=material,
        seasons=season_names,
        season=season_names,
        styles=style_names,
        tags=style_names,
        status=status,
        isArchived=status == "archived",
        createdAt=created,
        outfitCount=outfit_count,
        notes=row.get("notes") or "",
        image=image_url,
        imageUrl=image_url,
        primaryImageFileId=row.get("primary_image_file_id"),
    )


def _base_item_select():
    return (
        select(
            wardrobe_items,
            item_statuses.c.code.label("status_code"),
            brands.c.name.label("brand_name"),
            sizes.c.name.label("size_name"),
            subcategories.c.name.label("subcategory_name"),
        )
        .select_from(
            wardrobe_items.join(item_statuses, wardrobe_items.c.status_id == item_statuses.c.id)
            .outerjoin(brands, wardrobe_items.c.brand_id == brands.c.id)
            .outerjoin(sizes, wardrobe_items.c.size_id == sizes.c.id)
            .outerjoin(subcategories, wardrobe_items.c.subcategory_id == subcategories.c.id)
        )
    )


async def list_items(connection: AsyncConnection, user_id: str, params: dict[str, list[str] | str | bool]) -> list[ItemResponse]:
    rows = (await connection.execute(_base_item_select().where(wardrobe_items.c.user_id == user_id))).mappings().all()
    items = [await serialize_item(connection, dict(row)) for row in rows]

    def has_any(actual, expected):
        if not expected:
            return True
        actual_values = actual if isinstance(actual, list) else [actual]
        return any(value in actual_values for value in expected)

    q = normalize_name(str(params.get("q") or ""))
    filtered: list[ItemResponse] = []
    for item in items:
        if not params.get("includeArchived") and item.isArchived:
            continue
        if not has_any(item.catalogId, params.get("catalogId") or []):
            continue
        if not has_any(item.categoryId, params.get("categoryId") or []):
            continue
        if not has_any(item.subcategory, params.get("subcategory") or []):
            continue
        if not has_any(item.colors, params.get("color") or []):
            continue
        if not has_any(item.seasons, params.get("season") or []):
            continue
        if not has_any(item.styles, params.get("style") or []):
            continue
        if not has_any(item.brand, params.get("brand") or []):
            continue
        if not has_any(item.size, params.get("size") or []):
            continue
        if not has_any(item.material, params.get("material") or []):
            continue
        if not has_any(item.status, params.get("status") or []):
            continue
        participation = params.get("outfitParticipation")
        if participation == "withOutfits" and item.outfitCount == 0:
            continue
        if participation == "withoutOutfits" and item.outfitCount > 0:
            continue
        if q:
            haystack = normalize_name(
                " ".join(
                    [
                        item.title,
                        item.subcategory,
                        item.brand,
                        item.size,
                        item.material,
                        item.status,
                        *item.colors,
                        *item.seasons,
                        *item.styles,
                    ]
                )
            )
            if q not in haystack:
                continue
        filtered.append(item)

    if params.get("sortBy") == "outfitCount":
        return sorted(filtered, key=lambda item: item.outfitCount, reverse=True)
    return sorted(filtered, key=lambda item: item.createdAt, reverse=True)


async def get_item(connection: AsyncConnection, user_id: str, item_id: str) -> ItemResponse:
    row = (
        await connection.execute(_base_item_select().where(wardrobe_items.c.user_id == user_id, wardrobe_items.c.id == item_id))
    ).mappings().first()
    if row is None:
        raise LookupError("Item not found")
    return await serialize_item(connection, dict(row))


async def create_item(connection: AsyncConnection, user_id: str, payload: ItemPayload) -> ItemResponse:
    item_id = new_id("item")
    subcategory_id = await _ensure_subcategory(connection, user_id, payload.categoryId, payload.subcategory)
    values = {
        "id": item_id,
        "user_id": user_id,
        "catalog_id": payload.catalogId,
        "category_id": payload.categoryId,
        "subcategory_id": subcategory_id,
        "primary_image_file_id": payload.primaryImageFileId,
        "status_id": await _status_id(connection, payload.status),
        "name": payload.title.strip(),
        "brand_id": await _ensure_brand(connection, user_id, payload.brand),
        "size_id": await _size_id(connection, payload.size),
        "notes": payload.notes,
        "attributes_json": {"material": payload.material.strip()},
    }
    await connection.execute(insert(wardrobe_items).values(values))
    await _replace_item_links(connection, item_id, _csv(payload.colors), _csv(payload.seasons), _csv(payload.styles))
    return await get_item(connection, user_id, item_id)


async def patch_item(connection: AsyncConnection, user_id: str, item_id: str, payload: ItemPatch) -> ItemResponse:
    current = await get_item(connection, user_id, item_id)
    merged = ItemPayload(
        title=payload.title if payload.title is not None else current.title,
        catalogId=payload.catalogId if payload.catalogId is not None else current.catalogId,
        categoryId=payload.categoryId if payload.categoryId is not None else current.categoryId,
        subcategory=payload.subcategory if payload.subcategory is not None else current.subcategory,
        colors=payload.colors if payload.colors is not None else current.colors,
        brand=payload.brand if payload.brand is not None else current.brand,
        size=payload.size if payload.size is not None else current.size,
        material=payload.material if payload.material is not None else current.material,
        seasons=payload.seasons if payload.seasons is not None else current.seasons,
        styles=payload.styles if payload.styles is not None else current.styles,
        status=payload.status if payload.status is not None else current.status,
        notes=payload.notes if payload.notes is not None else current.notes,
        primaryImageFileId=payload.primaryImageFileId if payload.primaryImageFileId is not None else current.primaryImageFileId,
    )
    await connection.execute(
        update(wardrobe_items)
        .where(wardrobe_items.c.id == item_id, wardrobe_items.c.user_id == user_id)
        .values(
            catalog_id=merged.catalogId,
            category_id=merged.categoryId,
            subcategory_id=await _ensure_subcategory(connection, user_id, merged.categoryId, merged.subcategory),
            primary_image_file_id=merged.primaryImageFileId,
            status_id=await _status_id(connection, merged.status),
            name=merged.title.strip(),
            brand_id=await _ensure_brand(connection, user_id, merged.brand),
            size_id=await _size_id(connection, merged.size),
            notes=merged.notes,
            attributes_json={"material": merged.material.strip()},
            updated_at=datetime.now(timezone.utc),
        )
    )
    await _replace_item_links(connection, item_id, _csv(merged.colors), _csv(merged.seasons), _csv(merged.styles))
    return await get_item(connection, user_id, item_id)


async def delete_item(connection: AsyncConnection, user_id: str, item_id: str) -> None:
    await connection.execute(delete(wardrobe_items).where(wardrobe_items.c.id == item_id, wardrobe_items.c.user_id == user_id))


def _default_draft_payload(template: dict, source_type: str, catalog_id: str, file_id: str | None = None) -> dict:
    return {
        "title": template["name"],
        "catalogId": catalog_id,
        "categoryId": template["category_id"],
        "subcategory": template["subcategory_name"],
        "colors": template["colors_json"] or [],
        "brand": template["brand"] or "",
        "size": template["size_name"] or "",
        "material": template["material"] or "",
        "seasons": template["seasons_json"] or [],
        "styles": template["styles_json"] or [],
        "status": "active",
        "notes": "",
        "sourceType": source_type,
        "recognitionLabel": "Template defaults" if source_type == "catalog" else "Image processing in progress",
        "primaryImageFileId": file_id,
    }


async def _load_draft_row(connection: AsyncConnection, user_id: str, draft_id: str) -> dict:
    row = (
        await connection.execute(
            select(item_drafts).where(item_drafts.c.id == draft_id, item_drafts.c.user_id == user_id)
        )
    ).mappings().first()
    if row is None:
        raise LookupError("Draft not found")
    return dict(row)


async def _serialize_draft(connection: AsyncConnection, row: dict) -> DraftResponse:
    payload = dict(row.get("suggested_payload_json") or {})
    original_url = await get_file_url(connection, row.get("original_file_id"), "original")
    if original_url is None:
        original_url = await get_file_url(connection, row.get("original_file_id"), "card")
    cutout_url = await get_file_url(connection, row.get("processed_file_id"), "card")
    catalog_url = await get_file_url(connection, row.get("catalog_file_id"), "card")
    mask_url = await get_file_url(connection, row.get("mask_file_id"), "mask")
    mask_bitmap = await _mask_bitmap_payload(connection, row.get("mask_file_id"))
    original_preview_data_url = await _original_preview_data_url(
        connection,
        row.get("original_file_id"),
        mask_bitmap,
    )

    if row["processing_status"] == PRIMARY_READY_STATUS:
        primary_file_id = payload.get("primaryImageFileId") or row.get("processed_file_id") or row.get("original_file_id")
        if primary_file_id == row.get("catalog_file_id") and catalog_url:
            payload["image"] = catalog_url
        elif primary_file_id == row.get("processed_file_id") and cutout_url:
            payload["image"] = cutout_url
        else:
            payload["image"] = await get_file_url(connection, primary_file_id, "card")
        payload["primaryImageFileId"] = primary_file_id

    images = DraftImagesResponse(
        cutout=DraftImageAsset(fileId=row["processed_file_id"], imageUrl=cutout_url) if row.get("processed_file_id") else None,
        catalog=DraftImageAsset(fileId=row["catalog_file_id"], imageUrl=catalog_url) if row.get("catalog_file_id") else None,
    )
    return DraftResponse(
        id=row["id"],
        sourceType=row["source_type"],
        processingStatus=row["processing_status"],
        catalogProcessingStatus=row.get("catalog_processing_status") or CATALOG_NOT_REQUESTED_STATUS,
        ready=row["processing_status"] == PRIMARY_READY_STATUS,
        draft=payload if row["processing_status"] == PRIMARY_READY_STATUS else None,
        errorMessage=row.get("error_message"),
        catalogErrorMessage=row.get("catalog_error_message"),
        images=images,
        originalImageUrl=original_url,
        originalImagePreviewDataUrl=original_preview_data_url,
        maskImageUrl=mask_url,
        maskBitmap=mask_bitmap,
        mlResult=row.get("ml_result_json"),
    )


async def _original_preview_data_url(connection: AsyncConnection, original_file_id: str | None, mask_bitmap: dict | None) -> str | None:
    original_bytes = await get_file_bytes(connection, original_file_id, "original")
    if not original_bytes:
        return None
    image = ImageOps.exif_transpose(Image.open(BytesIO(original_bytes))).convert("RGB")
    target_width = int(mask_bitmap.get("width") or 0) if mask_bitmap else 0
    target_height = int(mask_bitmap.get("height") or 0) if mask_bitmap else 0
    if target_width > 0 and target_height > 0:
        image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
    else:
        scale = min(1, MASK_EDITOR_MAX_SIZE / max(image.size))
        if scale < 1:
            image = image.resize(
                (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                Image.Resampling.LANCZOS,
            )
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=95, optimize=True)
    return f"data:image/jpeg;base64,{base64.b64encode(buffer.getvalue()).decode('ascii')}"


async def _mask_bitmap_payload(connection: AsyncConnection, mask_file_id: str | None) -> dict | None:
    mask_bytes = await get_file_bytes(connection, mask_file_id, "mask")
    if not mask_bytes:
        return None
    mask = Image.open(BytesIO(mask_bytes)).convert("L")
    scale = min(1, MASK_EDITOR_MAX_SIZE / max(mask.size))
    if scale < 1:
        next_size = (max(1, round(mask.width * scale)), max(1, round(mask.height * scale)))
        mask = mask.resize(next_size, Image.Resampling.LANCZOS)
    raw = mask.tobytes()
    return {
        "width": mask.width,
        "height": mask.height,
        "dataBase64": base64.b64encode(raw).decode("ascii"),
    }


def _png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _apply_orientation(image: Image.Image, flip_horizontal: bool, rotation_degrees: int) -> Image.Image:
    if flip_horizontal:
        image = ImageOps.mirror(image)
    if rotation_degrees == 90:
        return image.transpose(Image.Transpose.ROTATE_270)
    if rotation_degrees == 180:
        return image.transpose(Image.Transpose.ROTATE_180)
    if rotation_degrees == 270:
        return image.transpose(Image.Transpose.ROTATE_90)
    return image


def _normalize_strokes(strokes_json: str | None) -> list[dict]:
    if not strokes_json:
        return []
    value = json.loads(strokes_json)
    if not isinstance(value, list):
        raise ValueError("Mask edit strokes must be a list")
    return value


def rebuild_cutout_from_mask(
    original_bytes: bytes,
    existing_mask_bytes: bytes | None,
    edited_mask_bytes: bytes | None,
    *,
    flip_horizontal: bool,
    rotation_degrees: int,
    strokes_json: str | None = None,
) -> tuple[bytes, bytes]:
    if rotation_degrees not in VALID_MASK_ROTATIONS:
        raise ValueError("rotationDegrees must be one of 0, 90, 180, 270")

    original = Image.open(BytesIO(original_bytes)).convert("RGBA")
    transformed_original = _apply_orientation(original, flip_horizontal, rotation_degrees)

    if edited_mask_bytes:
        mask = Image.open(BytesIO(edited_mask_bytes)).convert("L")
        if mask.size != original.size:
            mask = mask.resize(original.size, Image.Resampling.LANCZOS)
        mask = _apply_orientation(mask, flip_horizontal, rotation_degrees)
    elif existing_mask_bytes:
        mask = Image.open(BytesIO(existing_mask_bytes)).convert("L")
        if mask.size != original.size:
            mask = mask.resize(original.size, Image.Resampling.LANCZOS)
        mask = _apply_orientation(mask, flip_horizontal, rotation_degrees)
    else:
        raise ValueError("Mask image is missing")

    draw = ImageDraw.Draw(mask)
    width, height = mask.size
    for stroke in _normalize_strokes(strokes_json):
        points = stroke.get("points") or []
        if len(points) < 1:
            continue
        mode = stroke.get("mode")
        fill = 0 if mode == "erase" else 255
        brush_size = max(1, int(float(stroke.get("brushSize") or 20)))
        xy = [
            (
                max(0, min(width - 1, float(point.get("x", 0)) * width)),
                max(0, min(height - 1, float(point.get("y", 0)) * height)),
            )
            for point in points
        ]
        if len(xy) == 1:
            x, y = xy[0]
            radius = brush_size / 2
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)
        else:
            draw.line(xy, fill=fill, width=brush_size, joint="curve")
            radius = brush_size / 2
            for x, y in (xy[0], xy[-1]):
                draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)

    cutout = transformed_original.copy()
    cutout.putalpha(mask)
    return _png_bytes(cutout), _png_bytes(mask)


def pgm_mask_bytes_from_base64(mask_image_base64: str | None) -> bytes | None:
    if not mask_image_base64:
        return None
    try:
        return base64.b64decode(mask_image_base64, validate=True)
    except ValueError as exc:
        raise ValueError("maskImageBase64 must be valid base64") from exc


async def create_draft(
    connection: AsyncConnection,
    user_id: str,
    source_type: str,
    catalog_id: str,
    template_id: str | None = None,
    file_id: str | None = None,
) -> DraftResponse:
    fallback_template_id = template_id or ("template_5" if source_type == "gallery" else "template_1")
    template = (
        await connection.execute(select(wardrobe_item_templates).where(wardrobe_item_templates.c.id == fallback_template_id))
    ).mappings().first()
    if template is None:
        template = (
            await connection.execute(select(wardrobe_item_templates).order_by(wardrobe_item_templates.c.sort_order))
        ).mappings().first()
    if source_type in {"photo", "gallery"} and file_id is None:
        raise ValueError("Original image is required for photo drafts")

    draft_payload = _default_draft_payload(dict(template), source_type, catalog_id, file_id)
    is_catalog_source = source_type == "catalog"
    draft_id = new_id("draft")
    await connection.execute(
        insert(item_drafts).values(
            id=draft_id,
            user_id=user_id,
            source_type=source_type,
            processing_status=PRIMARY_READY_STATUS if is_catalog_source else "contour_preparing",
            catalog_id=catalog_id,
            original_file_id=file_id,
            processed_file_id=file_id if is_catalog_source else None,
            catalog_processing_status=CATALOG_NOT_REQUESTED_STATUS,
            suggested_payload_json=draft_payload,
            started_at=datetime.now(timezone.utc) if not is_catalog_source else None,
            finished_at=datetime.now(timezone.utc) if is_catalog_source else None,
        )
    )
    if not is_catalog_source:
        from app.tasks.wardrobe_tasks import trigger_prepare_item_photo_task

        await connection.commit()
        try:
            await trigger_prepare_item_photo_task(draft_id)
        except Exception as exc:
            await connection.execute(
                update(item_drafts)
                .where(item_drafts.c.id == draft_id)
                .values(
                    processing_status=PRIMARY_FAILED_STATUS,
                    error_message=str(exc),
                    updated_at=datetime.now(timezone.utc),
                    finished_at=datetime.now(timezone.utc),
                )
            )
    return await get_draft(connection, user_id, draft_id)


async def get_draft(connection: AsyncConnection, user_id: str, draft_id: str) -> DraftResponse:
    row = await _load_draft_row(connection, user_id, draft_id)
    return await _serialize_draft(connection, row)


async def enhance_draft(connection: AsyncConnection, user_id: str, draft_id: str) -> DraftResponse:
    row = await _load_draft_row(connection, user_id, draft_id)
    if row["processing_status"] != PRIMARY_READY_STATUS:
        raise ValueError("Draft is not ready for catalog enhancement")
    if not row.get("original_file_id") or not row.get("processed_file_id") or not row.get("mask_file_id"):
        raise ValueError("Draft does not have enough ML artifacts for catalog enhancement")
    catalog_status = row.get("catalog_processing_status") or CATALOG_NOT_REQUESTED_STATUS
    if catalog_status in {CATALOG_QUEUED_STATUS, CATALOG_PROCESSING_STATUS, CATALOG_READY_STATUS}:
        return await _serialize_draft(connection, row)

    await connection.execute(
        update(item_drafts)
        .where(item_drafts.c.id == draft_id)
        .values(
            catalog_processing_status=CATALOG_QUEUED_STATUS,
            catalog_error_message=None,
            updated_at=datetime.now(timezone.utc),
        )
    )
    from app.tasks.wardrobe_tasks import trigger_enhance_catalog_photo_task

    await connection.commit()
    try:
        await trigger_enhance_catalog_photo_task(draft_id)
    except Exception as exc:
        await connection.execute(
            update(item_drafts)
            .where(item_drafts.c.id == draft_id)
            .values(
                catalog_processing_status=CATALOG_FAILED_STATUS,
                catalog_error_message=str(exc),
                updated_at=datetime.now(timezone.utc),
            )
        )
    return await get_draft(connection, user_id, draft_id)


async def edit_draft_mask(
    connection: AsyncConnection,
    user_id: str,
    draft_id: str,
    *,
    mask_bytes: bytes | None,
    mask_image_base64: str | None,
    flip_horizontal: bool,
    rotation_degrees: int,
    strokes_json: str | None,
) -> DraftResponse:
    row = await _load_draft_row(connection, user_id, draft_id)
    if row["processing_status"] != PRIMARY_READY_STATUS:
        raise ValueError("Draft is not ready for mask editing")
    if not row.get("original_file_id"):
        raise ValueError("Draft does not have an original image")

    original_bytes = await get_file_bytes(connection, row["original_file_id"], "original")
    existing_mask_bytes = await get_file_bytes(connection, row.get("mask_file_id"), "mask")
    if not original_bytes:
        raise ValueError("Original image bytes are unavailable")

    edited_mask_bytes = mask_bytes or pgm_mask_bytes_from_base64(mask_image_base64)
    cutout_bytes, new_mask_bytes = rebuild_cutout_from_mask(
        original_bytes,
        existing_mask_bytes,
        edited_mask_bytes,
        flip_horizontal=flip_horizontal,
        rotation_degrees=rotation_degrees,
        strokes_json=strokes_json,
    )
    filename = f"mask-edit-{draft_id}.png"
    cutout_file_id = await create_image_file_with_variants(
        connection,
        user_id,
        transparent_cutout_variants(cutout_bytes),
        filename,
        "image/png",
    )
    mask_file_id = await create_image_file_with_variants(
        connection,
        user_id,
        {"mask": new_mask_bytes, "card": new_mask_bytes, "thumbnail": new_mask_bytes},
        f"mask-{filename}",
        "image/png",
    )

    payload = dict(row.get("suggested_payload_json") or {})
    payload["primaryImageFileId"] = cutout_file_id
    payload.pop("image", None)

    await connection.execute(
        update(item_drafts)
        .where(item_drafts.c.id == draft_id, item_drafts.c.user_id == user_id)
        .values(
            processed_file_id=cutout_file_id,
            mask_file_id=mask_file_id,
            catalog_file_id=None,
            catalog_processing_status=CATALOG_NOT_REQUESTED_STATUS,
            catalog_error_message=None,
            suggested_payload_json=payload,
            updated_at=datetime.now(timezone.utc),
        )
    )
    return await get_draft(connection, user_id, draft_id)


async def confirm_draft(connection: AsyncConnection, user_id: str, draft_id: str, override: ItemPatch | None = None) -> ItemResponse:
    row = await _load_draft_row(connection, user_id, draft_id)
    draft = await _serialize_draft(connection, row)
    if not draft.ready or not draft.draft:
        raise ValueError("Draft is not ready")
    data = dict(draft.draft)
    if override:
        for key, value in override.model_dump(exclude_unset=True).items():
            if value is not None:
                data[key] = value
    allowed_primary_ids = {row.get("original_file_id"), row.get("processed_file_id"), row.get("catalog_file_id")}
    selected_primary_id = data.get("primaryImageFileId")
    if selected_primary_id and selected_primary_id not in allowed_primary_ids:
        raise ValueError("Draft image selection is invalid")
    return await create_item(connection, user_id, ItemPayload(**data))
