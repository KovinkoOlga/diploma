from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import and_, delete, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncConnection

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
from app.modules.files.service import get_file_url, new_id
from app.modules.wardrobe.schemas import (
    BootstrapResponse,
    CatalogResponse,
    CategoryResponse,
    DraftResponse,
    ItemPatch,
    ItemPayload,
    ItemResponse,
    StatusResponse,
    TemplateResponse,
)


def normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().replace("ё", "е").split())


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
    style_rows = (await connection.execute(select(styles.c.name).where(styles.c.is_system.is_(True)).order_by(styles.c.name))).scalars().all()
    template_rows = (await connection.execute(select(wardrobe_item_templates).order_by(wardrobe_item_templates.c.sort_order))).mappings().all()

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
    count = (await connection.execute(select(func.count()).select_from(wardrobe_catalogs).where(wardrobe_catalogs.c.user_id == user_id))).scalar_one()
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


async def _replace_item_links(connection: AsyncConnection, item_id: str, color_names: list[str], season_names: list[str], style_names: list[str]) -> None:
    await connection.execute(delete(item_colors).where(item_colors.c.item_id == item_id))
    await connection.execute(delete(item_seasons).where(item_seasons.c.item_id == item_id))
    await connection.execute(delete(item_styles).where(item_styles.c.item_id == item_id))

    color_ids = await _ids_by_names(connection, colors, color_names)
    season_ids = await _ids_by_names(connection, seasons, season_names)
    style_ids = await _style_ids_by_names(connection, style_names)

    if color_ids:
        await connection.execute(insert(item_colors), [{"id": new_id("item_color"), "item_id": item_id, "color_id": color_id} for color_id in color_ids])
    if season_ids:
        await connection.execute(insert(item_seasons), [{"id": new_id("item_season"), "item_id": item_id, "season_id": season_id} for season_id in season_ids])
    if style_ids:
        await connection.execute(insert(item_styles), [{"id": new_id("item_style"), "item_id": item_id, "style_id": style_id} for style_id in style_ids])


async def _item_link_names(connection: AsyncConnection, item_id: str) -> tuple[list[str], list[str], list[str]]:
    color_rows = (
        await connection.execute(
            select(colors.c.name).select_from(item_colors.join(colors, item_colors.c.color_id == colors.c.id)).where(item_colors.c.item_id == item_id)
        )
    ).scalars().all()
    season_rows = (
        await connection.execute(
            select(seasons.c.name).select_from(item_seasons.join(seasons, item_seasons.c.season_id == seasons.c.id)).where(item_seasons.c.item_id == item_id)
        )
    ).scalars().all()
    style_rows = (
        await connection.execute(
            select(styles.c.name).select_from(item_styles.join(styles, item_styles.c.style_id == styles.c.id)).where(item_styles.c.item_id == item_id)
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
    if isinstance(created_at, datetime):
        created = created_at.date().isoformat()
    else:
        created = str(created_at)
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
            haystack = normalize_name(" ".join([item.title, item.subcategory, item.brand, item.size, item.material, item.status, *item.colors, *item.seasons, *item.styles]))
            if q not in haystack:
                continue
        filtered.append(item)

    if params.get("sortBy") == "outfitCount":
        return sorted(filtered, key=lambda item: item.outfitCount, reverse=True)
    return sorted(filtered, key=lambda item: item.createdAt, reverse=True)


async def get_item(connection: AsyncConnection, user_id: str, item_id: str) -> ItemResponse:
    row = (await connection.execute(_base_item_select().where(wardrobe_items.c.user_id == user_id, wardrobe_items.c.id == item_id))).mappings().first()
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


async def create_draft(connection: AsyncConnection, user_id: str, source_type: str, catalog_id: str, template_id: str | None = None, file_id: str | None = None) -> DraftResponse:
    fallback_template_id = template_id or ("template_5" if source_type == "gallery" else "template_1")
    template = (
        await connection.execute(select(wardrobe_item_templates).where(wardrobe_item_templates.c.id == fallback_template_id))
    ).mappings().first()
    if template is None:
        template = (await connection.execute(select(wardrobe_item_templates).order_by(wardrobe_item_templates.c.sort_order))).mappings().first()
    draft_payload = {
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
        "recognitionLabel": "Шаблон из базового каталога" if source_type == "catalog" else "Мок-распознавание после обработки изображения",
        "primaryImageFileId": file_id,
    }
    draft_id = new_id("draft")
    await connection.execute(
        insert(item_drafts).values(
            id=draft_id,
            user_id=user_id,
            source_type=source_type,
            processing_status="ready" if source_type == "catalog" else "contour_preparing",
            catalog_id=catalog_id,
            original_file_id=file_id,
            processed_file_id=file_id,
            suggested_payload_json=draft_payload,
        )
    )
    return await get_draft(connection, user_id, draft_id)


async def get_draft(connection: AsyncConnection, user_id: str, draft_id: str) -> DraftResponse:
    row = (await connection.execute(select(item_drafts).where(item_drafts.c.id == draft_id, item_drafts.c.user_id == user_id))).mappings().first()
    if row is None:
        raise LookupError("Draft not found")
    status = row["processing_status"]
    if status != "ready":
        elapsed = (datetime.now(timezone.utc) - row["created_at"]).total_seconds()
        if elapsed >= 2.2:
            status = "ready"
        elif elapsed >= 1.8:
            status = "attributes_suggested"
        elif elapsed >= 1.2:
            status = "category_recognizing"
        elif elapsed >= 0.6:
            status = "background_removing"
        if status != row["processing_status"]:
            await connection.execute(update(item_drafts).where(item_drafts.c.id == draft_id).values(processing_status=status, updated_at=datetime.now(timezone.utc)))
    payload = dict(row["suggested_payload_json"] or {})
    if payload.get("primaryImageFileId"):
        payload["image"] = await get_file_url(connection, payload["primaryImageFileId"], "card")
    return DraftResponse(
        id=row["id"],
        sourceType=row["source_type"],
        processingStatus=status,
        ready=status == "ready",
        draft=payload if status == "ready" else None,
        errorMessage=row["error_message"],
    )


async def confirm_draft(connection: AsyncConnection, user_id: str, draft_id: str, override: ItemPatch | None = None) -> ItemResponse:
    draft = await get_draft(connection, user_id, draft_id)
    if not draft.ready or not draft.draft:
        raise ValueError("Draft is not ready")
    data = dict(draft.draft)
    if override:
        for key, value in override.model_dump(exclude_unset=True).items():
            if value is not None:
                data[key] = value
    return await create_item(connection, user_id, ItemPayload(**data))

