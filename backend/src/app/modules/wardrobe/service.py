import base64
import json
from datetime import datetime, timezone
from io import BytesIO
from typing import Any

from pydantic import ValidationError
from sqlalchemy import and_, delete, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncConnection
from PIL import Image, ImageDraw, ImageOps

from app.core.config import get_settings
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
    outfits,
    seasons,
    styles,
    subcategories,
    wardrobe_catalogs,
    wardrobe_items,
)
from app.modules.files.service import (
    create_image_file_with_variants,
    get_file_bytes,
    get_file_url,
    new_id,
)
from app.modules.wardrobe.image_processing import compose_square_cutout, prepare_square_editor_assets
from app.modules.wardrobe.colors import (
    normalize_color_ids,
    validate_color_selection,
)
from app.modules.wardrobe.schemas import (
    BootstrapResponse,
    CatalogResponse,
    CategoryResponse,
    ColorResponse,
    DictionariesResponse,
    DictionaryBrandResponse,
    DictionaryStyleResponse,
    DictionarySubcategoryResponse,
    DraftImageAsset,
    DraftImagesResponse,
    DraftResponse,
    ItemPatch,
    ItemPayload,
    ItemResponse,
    StatusResponse,
)
from app.modules.wardrobe.taxonomy import SYSTEM_SUBCATEGORIES


PRIMARY_READY_STATUS = "ready"
PRIMARY_FAILED_STATUS = "failed"
PRIMARY_QUEUED_STATUS = "queued"
PRIMARY_PREPARING_STATUS = "preparing"
PRIMARY_BACKGROUND_REMOVING_STATUS = "background_removing"
PRIMARY_CATEGORY_RECOGNIZING_STATUS = "category_recognizing"
PRIMARY_COLORS_EXTRACTING_STATUS = "colors_extracting"
PRIMARY_ATTRIBUTES_SUGGESTED_STATUS = "attributes_suggested"
PRIMARY_TERMINAL_STATUSES = frozenset({PRIMARY_READY_STATUS, PRIMARY_FAILED_STATUS})
INTERNAL_PROGRESS_ALLOWED_STATUSES = frozenset(
    {
        PRIMARY_PREPARING_STATUS,
        PRIMARY_BACKGROUND_REMOVING_STATUS,
        PRIMARY_CATEGORY_RECOGNIZING_STATUS,
        PRIMARY_COLORS_EXTRACTING_STATUS,
        PRIMARY_ATTRIBUTES_SUGGESTED_STATUS,
        PRIMARY_FAILED_STATUS,
    }
)
VALID_MASK_ROTATIONS = {0, 90, 180, 270}
STYLE_SEPARATOR_PATTERN = r"\s*[_/\\-]+\s*"

CONFIRM_DRAFT_FIELD_LABELS = {
    "title": "название",
    "catalogId": "каталог",
    "categoryId": "категория",
    "subcategory": "подкатегория",
    "primaryImageFileId": "изображение вещи",
    "status": "статус",
}


def normalize_name(value: str) -> str:
    import re
    import unicodedata

    normalized = unicodedata.normalize("NFC", str(value or "")).strip()
    normalized = re.sub(STYLE_SEPARATOR_PATTERN, " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.lower().strip()


def _csv(values: list[str] | None) -> list[str]:
    return [value for value in (values or []) if value]


def _clean_names(values: list[str] | None) -> list[str]:
    seen: set[str] = set()
    cleaned: list[str] = []
    for value in values or []:
        name = str(value or "").strip()
        if not name:
            continue
        normalized = normalize_name(name)
        if normalized in seen:
            continue
        seen.add(normalized)
        cleaned.append(name)
    return cleaned


def _color_response(row: dict[str, Any]) -> ColorResponse:
    return ColorResponse(
        id=row["id"],
        name=row["name"],
        parentColorId=row.get("parent_color_id"),
        parentName=row.get("parent_name"),
        hex=row.get("hex"),
        kind=row["kind"],
        sortOrder=row["sort_order"],
    )


def _color_row_dict(option: ColorResponse) -> dict[str, Any]:
    return {
        "id": option.id,
        "name": option.name,
        "parent_color_id": option.parentColorId,
        "parent_name": option.parentName,
        "hex": option.hex,
        "kind": option.kind,
        "sort_order": option.sortOrder,
    }


async def get_color_options(connection: AsyncConnection) -> list[ColorResponse]:
    parent_colors = colors.alias("parent_colors")
    rows = (
        await connection.execute(
            select(
                colors.c.id,
                colors.c.name,
                colors.c.parent_color_id,
                parent_colors.c.name.label("parent_name"),
                colors.c.hex,
                colors.c.kind,
                colors.c.sort_order,
            )
            .select_from(colors.outerjoin(parent_colors, colors.c.parent_color_id == parent_colors.c.id))
            .order_by(colors.c.sort_order, colors.c.name)
        )
    ).mappings().all()
    return [_color_response(dict(row)) for row in rows]


async def get_selectable_color_palette(connection: AsyncConnection) -> list[dict[str, Any]]:
    options = await get_color_options(connection)
    return [
        _color_row_dict(option)
        for option in options
        if option.parentColorId is not None
    ]


async def _color_rows_by_id(connection: AsyncConnection) -> dict[str, dict[str, Any]]:
    return {option.id: _color_row_dict(option) for option in await get_color_options(connection)}


async def _season_ids_by_names(connection: AsyncConnection, names: list[str]) -> list[str]:
    if not names:
        return []
    rows = (await connection.execute(select(seasons.c.id, seasons.c.name).where(seasons.c.name.in_(names)))).mappings().all()
    return [row["id"] for row in rows]


async def _season_names(connection: AsyncConnection) -> list[str]:
    return list((await connection.execute(select(seasons.c.name).order_by(seasons.c.sort_order, seasons.c.name))).scalars().all())


def _build_item_color_rows(color_ids: list[str], color_prediction: dict[str, Any] | None) -> list[dict[str, Any]]:
    prediction_by_id = {
        str(entry.get("id")): entry
        for entry in ((color_prediction or {}).get("colors") or [])
        if isinstance(entry, dict) and entry.get("id")
    }
    predicted_color_ids = [
        str(color_id)
        for color_id in ((color_prediction or {}).get("color_ids") or [])
        if color_id
    ]
    source = "ml" if predicted_color_ids == [str(color_id) for color_id in color_ids] and color_prediction else "manual"
    rows: list[dict[str, Any]] = []
    for position, color_id in enumerate(color_ids):
        predicted = prediction_by_id.get(color_id) or {}
        rows.append(
            {
                "id": new_id("item_color"),
                "item_id": None,
                "color_id": color_id,
                "position": position,
                "coverage_percent": predicted.get("coverage_percent"),
                "source": source,
                "confidence": predicted.get("confidence") if source == "ml" else None,
            }
        )
    return rows


def _merge_item_attributes(
    current_attributes: dict[str, Any] | None,
    *,
    category_prediction: dict[str, Any] | None,
    color_prediction: dict[str, Any] | None,
    preserve_existing_ml: bool = True,
) -> dict[str, Any]:
    attributes = dict(current_attributes or {})

    existing_ml = attributes.get("ml") if isinstance(attributes.get("ml"), dict) else {}
    ml_payload = dict(existing_ml) if preserve_existing_ml else {}
    if category_prediction is not None:
        ml_payload["categoryPrediction"] = category_prediction
    if color_prediction is not None:
        ml_payload["colorPrediction"] = color_prediction

    if ml_payload:
        attributes["ml"] = ml_payload
    else:
        attributes.pop("ml", None)

    return attributes


def _ordered_unique_subcategory_names(entries: list[dict[str, Any]]) -> list[str]:
    seen: set[str] = set()
    names: list[str] = []
    for entry in entries:
        name = str(entry["name"])
        if name in seen:
            continue
        seen.add(name)
        names.append(name)
    return names


def _ordered_unique_style_names(rows: list[dict[str, Any]]) -> list[str]:
    seen: set[str] = set()
    names: list[str] = []
    for row in rows:
        name = str(row["name"] or "").strip()
        normalized = str(row.get("normalized_name") or normalize_name(name))
        if not name or normalized in seen:
            continue
        seen.add(normalized)
        names.append(name)
    return names


def _catalog_response(row: dict[str, Any]) -> CatalogResponse:
    return CatalogResponse(
        id=row["id"],
        title=row["name"],
        sortOrder=row["sort_order"],
        isDefault=row["is_default"],
    )


def _dictionary_subcategory_response(row: dict[str, Any]) -> DictionarySubcategoryResponse:
    return DictionarySubcategoryResponse(
        id=row["id"],
        name=row["name"],
        categoryId=row["category_id"],
        categoryTitle=row["category_name"],
        isSystem=bool(row.get("is_system", False)),
        itemCount=int(row.get("item_count") or 0),
    )


def _dictionary_style_response(row: dict[str, Any]) -> DictionaryStyleResponse:
    return DictionaryStyleResponse(
        id=row["id"],
        name=row["name"],
        isSystem=bool(row.get("is_system", False)),
        itemCount=int(row.get("item_count") or 0),
        outfitCount=int(row.get("outfit_count") or 0),
    )


def _dictionary_brand_response(row: dict[str, Any]) -> DictionaryBrandResponse:
    return DictionaryBrandResponse(
        id=row["id"],
        name=row["name"],
        itemCount=int(row.get("item_count") or 0),
    )


async def _dictionary_subcategory_rows(connection: AsyncConnection, user_id: str) -> list[dict[str, Any]]:
    rows = (
        await connection.execute(
            select(
                subcategories.c.id,
                subcategories.c.name,
                subcategories.c.category_id,
                categories.c.name.label("category_name"),
                categories.c.sort_order.label("category_sort_order"),
                subcategories.c.is_system,
                func.count(wardrobe_items.c.id).label("item_count"),
            )
            .select_from(
                subcategories.join(categories, subcategories.c.category_id == categories.c.id).outerjoin(
                    wardrobe_items,
                    and_(
                        wardrobe_items.c.subcategory_id == subcategories.c.id,
                        wardrobe_items.c.user_id == user_id,
                    ),
                )
            )
            .where(subcategories.c.user_id == user_id)
            .group_by(
                subcategories.c.id,
                subcategories.c.name,
                subcategories.c.category_id,
                categories.c.name,
                categories.c.sort_order,
                subcategories.c.is_system,
            )
            .order_by(categories.c.sort_order, categories.c.name, subcategories.c.name)
        )
    ).mappings().all()
    return [dict(row) for row in rows]


async def _dictionary_style_rows(connection: AsyncConnection, user_id: str) -> list[dict[str, Any]]:
    rows = (
        await connection.execute(
            select(
                styles.c.id,
                styles.c.name,
                styles.c.is_system,
                func.count(func.distinct(wardrobe_items.c.id)).label("item_count"),
                func.count(func.distinct(outfits.c.id)).label("outfit_count"),
            )
            .select_from(
                styles.outerjoin(item_styles, item_styles.c.style_id == styles.c.id).outerjoin(
                    wardrobe_items,
                    and_(
                        wardrobe_items.c.id == item_styles.c.item_id,
                        wardrobe_items.c.user_id == user_id,
                    ),
                ).outerjoin(
                    outfits,
                    and_(
                        outfits.c.style_id == styles.c.id,
                        outfits.c.user_id == user_id,
                    ),
                )
            )
            .where(styles.c.user_id == user_id)
            .group_by(styles.c.id, styles.c.name, styles.c.is_system)
            .order_by(styles.c.name)
        )
    ).mappings().all()
    return [dict(row) for row in rows]


async def _dictionary_brand_rows(connection: AsyncConnection, user_id: str) -> list[dict[str, Any]]:
    rows = (
        await connection.execute(
            select(
                brands.c.id,
                brands.c.name,
                func.count(wardrobe_items.c.id).label("item_count"),
            )
            .select_from(
                brands.outerjoin(
                    wardrobe_items,
                    and_(
                        wardrobe_items.c.brand_id == brands.c.id,
                        wardrobe_items.c.user_id == user_id,
                    ),
                )
            )
            .where(brands.c.user_id == user_id)
            .group_by(brands.c.id, brands.c.name)
            .order_by(brands.c.name)
        )
    ).mappings().all()
    return [dict(row) for row in rows]


async def _dictionary_subcategory_entry(
    connection: AsyncConnection, user_id: str, subcategory_id: str
) -> DictionarySubcategoryResponse:
    rows = await _dictionary_subcategory_rows(connection, user_id)
    for row in rows:
        if row["id"] == subcategory_id:
            return _dictionary_subcategory_response(row)
    raise LookupError("Subcategory not found")


async def _dictionary_style_entry(connection: AsyncConnection, user_id: str, style_id: str) -> DictionaryStyleResponse:
    rows = await _dictionary_style_rows(connection, user_id)
    for row in rows:
        if row["id"] == style_id:
            return _dictionary_style_response(row)
    raise LookupError("Style not found")


async def _dictionary_brand_entry(connection: AsyncConnection, user_id: str, brand_id: str) -> DictionaryBrandResponse:
    rows = await _dictionary_brand_rows(connection, user_id)
    for row in rows:
        if row["id"] == brand_id:
            return _dictionary_brand_response(row)
    raise LookupError("Brand not found")


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
    model_system_subcategory_ids = {entry["id"] for entry in SYSTEM_SUBCATEGORIES}
    model_system_subcategory_order = {entry["id"]: index for index, entry in enumerate(SYSTEM_SUBCATEGORIES)}
    subcategories_by_category: dict[str, list[dict[str, Any]]] = {}
    for row in subcategory_rows:
        is_model_system = row["id"] in model_system_subcategory_ids
        if row["user_id"] is None and row.get("is_system") and not is_model_system:
            continue
        subcategories_by_category.setdefault(row["category_id"], []).append(
            {
                "id": row["id"],
                "name": row["name"],
                "is_system": row.get("is_system", False),
                "order": model_system_subcategory_order.get(row["id"], 10_000),
            }
        )

    status_rows = (await connection.execute(select(item_statuses).order_by(item_statuses.c.sort_order))).mappings().all()
    color_options = await get_color_options(connection)
    season_rows = await _season_names(connection)
    style_rows = (
        await connection.execute(
            select(styles.c.name, styles.c.normalized_name, styles.c.is_system)
            .where(or_(styles.c.is_system.is_(True), styles.c.user_id == user_id))
            .order_by(styles.c.is_system.desc(), styles.c.name)
        )
    ).mappings().all()
    return BootstrapResponse(
        catalogs=[_catalog_response(dict(row)) for row in catalog_rows],
        categories=[
            CategoryResponse(
                id=row["id"],
                title=row["name"],
                icon=row["icon_key"],
                subcategories=_ordered_unique_subcategory_names(
                    sorted(
                        subcategories_by_category.get(row["id"], []),
                        key=lambda entry: (
                            0 if entry["is_system"] else 1,
                            entry["order"],
                            entry["name"],
                        ),
                    )
                ),
            )
            for row in category_rows
        ],
        colorOptions=color_options,
        seasons=list(season_rows),
        styles=_ordered_unique_style_names([dict(row) for row in style_rows]),
        statuses=[StatusResponse(id=row["code"], title=row["name"]) for row in status_rows],
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


async def get_dictionaries(connection: AsyncConnection, user_id: str) -> DictionariesResponse:
    subcategory_rows = await _dictionary_subcategory_rows(connection, user_id)
    style_rows = await _dictionary_style_rows(connection, user_id)
    brand_rows = await _dictionary_brand_rows(connection, user_id)
    return DictionariesResponse(
        subcategories=[_dictionary_subcategory_response(row) for row in subcategory_rows],
        styles=[_dictionary_style_response(row) for row in style_rows],
        brands=[_dictionary_brand_response(row) for row in brand_rows],
    )


async def rename_subcategory(
    connection: AsyncConnection,
    user_id: str,
    subcategory_id: str,
    name: str,
) -> DictionarySubcategoryResponse:
    row = (
        await connection.execute(
            select(subcategories.c.id, subcategories.c.category_id, subcategories.c.is_system, subcategories.c.user_id).where(
                subcategories.c.id == subcategory_id
            )
        )
    ).mappings().first()
    if row is None:
        raise LookupError("Subcategory not found")
    if row["user_id"] != user_id or row["is_system"]:
        raise PermissionError("System subcategory cannot be edited")

    clean_name = str(name or "").strip()
    if not clean_name:
        raise ValueError("Подкатегория не может быть пустой")
    normalized = normalize_name(clean_name)
    conflict = (
        await connection.execute(
            select(subcategories.c.id).where(
                subcategories.c.id != subcategory_id,
                subcategories.c.category_id == row["category_id"],
                subcategories.c.normalized_name == normalized,
                or_(subcategories.c.user_id == user_id, subcategories.c.user_id.is_(None)),
            )
        )
    ).first()
    if conflict is not None:
        raise ValueError("Подкатегория уже существует")

    await connection.execute(
        update(subcategories)
        .where(subcategories.c.id == subcategory_id, subcategories.c.user_id == user_id)
        .values(name=clean_name, normalized_name=normalized)
    )
    return await _dictionary_subcategory_entry(connection, user_id, subcategory_id)


async def delete_subcategory(connection: AsyncConnection, user_id: str, subcategory_id: str) -> None:
    row = (
        await connection.execute(
            select(subcategories.c.id, subcategories.c.is_system, subcategories.c.user_id).where(subcategories.c.id == subcategory_id)
        )
    ).mappings().first()
    if row is None:
        raise LookupError("Subcategory not found")
    if row["user_id"] != user_id or row["is_system"]:
        raise PermissionError("System subcategory cannot be deleted")

    usage_count = (
        await connection.execute(
            select(func.count())
            .select_from(wardrobe_items)
            .where(
                wardrobe_items.c.user_id == user_id,
                wardrobe_items.c.subcategory_id == subcategory_id,
            )
        )
    ).scalar_one()
    if usage_count:
        raise ValueError("Подкатегория используется в вещах")

    await connection.execute(
        delete(subcategories).where(subcategories.c.id == subcategory_id, subcategories.c.user_id == user_id)
    )


async def rename_style(connection: AsyncConnection, user_id: str, style_id: str, name: str) -> DictionaryStyleResponse:
    row = (
        await connection.execute(select(styles.c.id, styles.c.user_id, styles.c.is_system).where(styles.c.id == style_id))
    ).mappings().first()
    if row is None:
        raise LookupError("Style not found")
    if row["user_id"] != user_id or row["is_system"]:
        raise PermissionError("System style cannot be edited")

    clean_name = str(name or "").strip()
    if not clean_name:
        raise ValueError("Стиль не может быть пустым")
    normalized = normalize_name(clean_name)
    conflict = (
        await connection.execute(
            select(styles.c.id).where(
                styles.c.id != style_id,
                styles.c.normalized_name == normalized,
                or_(styles.c.is_system.is_(True), styles.c.user_id == user_id),
            )
        )
    ).first()
    if conflict is not None:
        raise ValueError("Стиль уже существует")

    await connection.execute(
        update(styles).where(styles.c.id == style_id, styles.c.user_id == user_id).values(name=clean_name, normalized_name=normalized)
    )
    return await _dictionary_style_entry(connection, user_id, style_id)


async def delete_style(connection: AsyncConnection, user_id: str, style_id: str) -> None:
    row = (
        await connection.execute(select(styles.c.id, styles.c.user_id, styles.c.is_system).where(styles.c.id == style_id))
    ).mappings().first()
    if row is None:
        raise LookupError("Style not found")
    if row["user_id"] != user_id or row["is_system"]:
        raise PermissionError("System style cannot be deleted")

    usage_count = (
        await connection.execute(
            select(func.count(func.distinct(wardrobe_items.c.id)))
            .select_from(item_styles.join(wardrobe_items, wardrobe_items.c.id == item_styles.c.item_id))
            .where(
                item_styles.c.style_id == style_id,
                wardrobe_items.c.user_id == user_id,
            )
        )
    ).scalar_one()
    if usage_count:
        raise ValueError("Стиль используется в вещах")

    await connection.execute(
        delete(item_styles).where(
            item_styles.c.style_id == style_id,
            item_styles.c.item_id.in_(select(wardrobe_items.c.id).where(wardrobe_items.c.user_id == user_id)),
        )
    )
    await connection.execute(
        update(outfits)
        .where(
            outfits.c.user_id == user_id,
            outfits.c.style_id == style_id,
        )
        .values(style_id=None)
    )
    await connection.execute(delete(styles).where(styles.c.id == style_id, styles.c.user_id == user_id))


async def rename_brand(connection: AsyncConnection, user_id: str, brand_id: str, name: str) -> DictionaryBrandResponse:
    row = (
        await connection.execute(select(brands.c.id, brands.c.user_id).where(brands.c.id == brand_id))
    ).mappings().first()
    if row is None:
        raise LookupError("Brand not found")
    if row["user_id"] != user_id:
        raise LookupError("Brand not found")

    clean_name = str(name or "").strip()
    if not clean_name:
        raise ValueError("Бренд не может быть пустым")
    normalized = normalize_name(clean_name)
    conflict = (
        await connection.execute(
            select(brands.c.id).where(
                brands.c.id != brand_id,
                brands.c.user_id == user_id,
                brands.c.normalized_name == normalized,
            )
        )
    ).first()
    if conflict is not None:
        raise ValueError("Бренд уже существует")

    await connection.execute(
        update(brands).where(brands.c.id == brand_id, brands.c.user_id == user_id).values(name=clean_name, normalized_name=normalized)
    )
    return await _dictionary_brand_entry(connection, user_id, brand_id)


async def delete_brand(connection: AsyncConnection, user_id: str, brand_id: str) -> None:
    row = (
        await connection.execute(select(brands.c.id, brands.c.user_id).where(brands.c.id == brand_id))
    ).mappings().first()
    if row is None:
        raise LookupError("Brand not found")
    if row["user_id"] != user_id:
        raise LookupError("Brand not found")

    usage_count = (
        await connection.execute(
            select(func.count())
            .select_from(wardrobe_items)
            .where(
                wardrobe_items.c.user_id == user_id,
                wardrobe_items.c.brand_id == brand_id,
            )
        )
    ).scalar_one()
    if usage_count:
        raise ValueError("Бренд используется в вещах")

    await connection.execute(delete(brands).where(brands.c.id == brand_id, brands.c.user_id == user_id))


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


async def _ensure_style_ids(connection: AsyncConnection, user_id: str, names: list[str]) -> list[str]:
    cleaned_names = _clean_names(names)
    if not cleaned_names:
        return []

    normalized_names = [normalize_name(name) for name in cleaned_names]
    existing_rows = (
        await connection.execute(
            select(styles.c.id, styles.c.name, styles.c.normalized_name, styles.c.is_system)
            .where(
                styles.c.normalized_name.in_(normalized_names),
                or_(styles.c.is_system.is_(True), styles.c.user_id == user_id),
            )
            .order_by(styles.c.is_system.desc(), styles.c.name)
        )
    ).mappings().all()

    existing_by_normalized: dict[str, str] = {}
    for row in existing_rows:
        existing_by_normalized.setdefault(str(row["normalized_name"]), str(row["id"]))

    resolved_ids: list[str] = []
    for name, normalized in zip(cleaned_names, normalized_names, strict=False):
        existing_id = existing_by_normalized.get(normalized)
        if existing_id is not None:
            resolved_ids.append(existing_id)
            continue

        style_id = new_id("style")
        await connection.execute(
            insert(styles).values(
                id=style_id,
                user_id=user_id,
                name=name,
                normalized_name=normalized,
                is_system=False,
            )
        )
        existing_by_normalized[normalized] = style_id
        resolved_ids.append(style_id)

    return resolved_ids


async def _replace_item_links(
    connection: AsyncConnection,
    user_id: str,
    item_id: str,
    color_ids: list[str] | None,
    season_names: list[str],
    style_names: list[str],
    *,
    replace_colors: bool = True,
    replace_seasons: bool = True,
    replace_styles: bool = True,
    color_prediction: dict[str, Any] | None = None,
) -> None:
    if replace_colors:
        color_rows_by_id = await _color_rows_by_id(connection)
        validated_color_ids = validate_color_selection(color_ids or [], color_rows_by_id)
        await connection.execute(delete(item_colors).where(item_colors.c.item_id == item_id))
        if validated_color_ids:
            color_rows = _build_item_color_rows(validated_color_ids, color_prediction)
            for row in color_rows:
                row["item_id"] = item_id
            await connection.execute(insert(item_colors), color_rows)

    if replace_seasons:
        await connection.execute(delete(item_seasons).where(item_seasons.c.item_id == item_id))
    if replace_styles:
        await connection.execute(delete(item_styles).where(item_styles.c.item_id == item_id))

    season_ids = await _season_ids_by_names(connection, _clean_names(season_names)) if replace_seasons else []
    style_ids = await _ensure_style_ids(connection, user_id, style_names) if replace_styles else []
    if replace_seasons and season_ids:
        await connection.execute(
            insert(item_seasons),
            [{"id": new_id("item_season"), "item_id": item_id, "season_id": season_id} for season_id in season_ids],
        )
    if replace_styles and style_ids:
        await connection.execute(
            insert(item_styles),
            [{"id": new_id("item_style"), "item_id": item_id, "style_id": style_id} for style_id in style_ids],
        )


async def _item_links(connection: AsyncConnection, item_id: str) -> tuple[list[ColorResponse], list[str], list[str]]:
    parent_colors = colors.alias("parent_colors")
    color_rows = (
        await connection.execute(
            select(
                colors.c.id,
                colors.c.name,
                colors.c.parent_color_id,
                parent_colors.c.name.label("parent_name"),
                colors.c.hex,
                colors.c.kind,
                colors.c.sort_order,
            )
            .select_from(
                item_colors.join(colors, item_colors.c.color_id == colors.c.id).outerjoin(
                    parent_colors, colors.c.parent_color_id == parent_colors.c.id
                )
            )
            .where(item_colors.c.item_id == item_id)
            .order_by(item_colors.c.position, colors.c.sort_order, colors.c.name)
        )
    ).mappings().all()
    season_rows = (
        await connection.execute(
            select(seasons.c.name)
            .select_from(item_seasons.join(seasons, item_seasons.c.season_id == seasons.c.id))
            .where(item_seasons.c.item_id == item_id)
            .order_by(seasons.c.sort_order, seasons.c.name)
        )
    ).scalars().all()
    style_rows = (
        await connection.execute(
            select(styles.c.name)
            .select_from(item_styles.join(styles, item_styles.c.style_id == styles.c.id))
            .where(item_styles.c.item_id == item_id)
            .order_by(styles.c.is_system.desc(), styles.c.name)
        )
    ).scalars().all()
    return [_color_response(dict(row)) for row in color_rows], list(season_rows), list(style_rows)


async def serialize_item(connection: AsyncConnection, row: dict) -> ItemResponse:
    color_details, season_names, style_names = await _item_links(connection, row["id"])
    outfit_count = (
        await connection.execute(select(func.count()).select_from(outfit_items).where(outfit_items.c.item_id == row["id"]))
    ).scalar_one()
    image_url = await get_file_url(connection, row.get("primary_image_file_id"), "card")
    created_at = row["created_at"]
    created = created_at.date().isoformat() if isinstance(created_at, datetime) else str(created_at)
    status = row["status_code"]
    return ItemResponse(
        id=row["id"],
        title=row["name"],
        catalogId=row["catalog_id"],
        categoryId=row["category_id"],
        subcategory=row.get("subcategory_name") or "",
        colorIds=[color.id for color in color_details],
        colorDetails=color_details,
        brand=row.get("brand_name") or "",
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
            subcategories.c.name.label("subcategory_name"),
        )
        .select_from(
            wardrobe_items.join(item_statuses, wardrobe_items.c.status_id == item_statuses.c.id)
            .outerjoin(brands, wardrobe_items.c.brand_id == brands.c.id)
            .outerjoin(subcategories, wardrobe_items.c.subcategory_id == subcategories.c.id)
        )
    )


async def list_items(connection: AsyncConnection, user_id: str, params: dict[str, list[str] | str | bool]) -> list[ItemResponse]:
    rows = (await connection.execute(_base_item_select().where(wardrobe_items.c.user_id == user_id))).mappings().all()
    items = [await serialize_item(connection, dict(row)) for row in rows]
    color_options = await get_color_options(connection)
    color_by_id = {option.id: option for option in color_options}
    descendant_ids_by_parent: dict[str, set[str]] = {}
    for option in color_options:
        if option.parentColorId:
            descendant_ids_by_parent.setdefault(option.parentColorId, set()).add(option.id)

    def has_any(actual, expected):
        if not expected:
            return True
        actual_values = actual if isinstance(actual, list) else [actual]
        return any(value in actual_values for value in expected)

    def has_color_match(item: ItemResponse, expected: list[str]) -> bool:
        if not expected:
            return True
        actual_ids = set(item.colorIds)
        for color_id in expected:
            option = color_by_id.get(color_id)
            if option is None:
                continue
            if option.parentColorId is None:
                if actual_ids & descendant_ids_by_parent.get(color_id, set()):
                    return True
            elif color_id in actual_ids:
                return True
        return False

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
        if not has_color_match(item, params.get("color") or []):
            continue
        if not has_any(item.seasons, params.get("season") or []):
            continue
        if not has_any(item.styles, params.get("style") or []):
            continue
        if not has_any(item.brand, params.get("brand") or []):
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
                        item.status,
                        *[color.name for color in item.colorDetails],
                        *[color.parentName for color in item.colorDetails if color.parentName],
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
        "notes": payload.notes,
        "attributes_json": _merge_item_attributes(
            None,
            category_prediction=payload.categoryPrediction,
            color_prediction=payload.colorPrediction,
            preserve_existing_ml=False,
        ),
    }
    await connection.execute(insert(wardrobe_items).values(values))
    await _replace_item_links(
        connection,
        user_id,
        item_id,
        normalize_color_ids(payload.colorIds),
        _csv(payload.seasons),
        _csv(payload.styles),
        color_prediction=payload.colorPrediction,
    )
    return await get_item(connection, user_id, item_id)


async def patch_item(connection: AsyncConnection, user_id: str, item_id: str, payload: ItemPatch) -> ItemResponse:
    current = await get_item(connection, user_id, item_id)
    current_row = (
        await connection.execute(
            select(wardrobe_items.c.attributes_json).where(
                wardrobe_items.c.id == item_id,
                wardrobe_items.c.user_id == user_id,
            )
        )
    ).mappings().first()
    current_attributes = dict((current_row or {}).get("attributes_json") or {})
    merged = ItemPayload(
        title=payload.title if payload.title is not None else current.title,
        catalogId=payload.catalogId if payload.catalogId is not None else current.catalogId,
        categoryId=payload.categoryId if payload.categoryId is not None else current.categoryId,
        subcategory=payload.subcategory if payload.subcategory is not None else current.subcategory,
        colorIds=payload.colorIds if payload.colorIds is not None else current.colorIds,
        brand=payload.brand if payload.brand is not None else current.brand,
        seasons=payload.seasons if payload.seasons is not None else current.seasons,
        styles=payload.styles if payload.styles is not None else current.styles,
        status=payload.status if payload.status is not None else current.status,
        notes=payload.notes if payload.notes is not None else current.notes,
        primaryImageFileId=payload.primaryImageFileId if payload.primaryImageFileId is not None else current.primaryImageFileId,
        categoryPrediction=payload.categoryPrediction,
        colorPrediction=payload.colorPrediction,
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
            notes=merged.notes,
            attributes_json=_merge_item_attributes(
                current_attributes,
                category_prediction=payload.categoryPrediction,
                color_prediction=payload.colorPrediction,
            ),
            updated_at=datetime.now(timezone.utc),
        )
    )
    await _replace_item_links(
        connection,
        user_id,
        item_id,
        normalize_color_ids(merged.colorIds),
        _csv(merged.seasons),
        _csv(merged.styles),
        replace_colors=payload.colorIds is not None,
        replace_seasons=payload.seasons is not None,
        replace_styles=payload.styles is not None,
        color_prediction=payload.colorPrediction,
    )
    return await get_item(connection, user_id, item_id)


async def delete_item(connection: AsyncConnection, user_id: str, item_id: str) -> None:
    await connection.execute(delete(wardrobe_items).where(wardrobe_items.c.id == item_id, wardrobe_items.c.user_id == user_id))


def _default_draft_payload(source_type: str, catalog_id: str, file_id: str | None = None) -> dict:
    return {
        "title": "",
        "catalogId": catalog_id,
        "categoryId": "",
        "subcategory": "",
        "colorIds": [],
        "brand": "",
        "seasons": [],
        "styles": [],
        "status": "active",
        "notes": "",
        "sourceType": source_type,
        "recognitionLabel": "Image processing in progress",
        "primaryImageFileId": file_id,
        "categoryPrediction": None,
        "subcategorySuggestions": [],
        "colorPrediction": None,
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


async def _load_draft_row_any(connection: AsyncConnection, draft_id: str) -> dict:
    row = (await connection.execute(select(item_drafts).where(item_drafts.c.id == draft_id))).mappings().first()
    if row is None:
        raise LookupError("Draft not found")
    return dict(row)


async def apply_internal_draft_progress(connection: AsyncConnection, draft_id: str, processing_status: str) -> dict:
    if processing_status not in INTERNAL_PROGRESS_ALLOWED_STATUSES:
        raise ValueError(f"Unsupported draft processing status: {processing_status}")

    row = await _load_draft_row_any(connection, draft_id)
    if row["processing_status"] in PRIMARY_TERMINAL_STATUSES:
        return row

    now = datetime.now(timezone.utc)
    values = {
        "processing_status": processing_status,
        "updated_at": now,
    }
    if processing_status == PRIMARY_FAILED_STATUS:
        values["finished_at"] = now
    else:
        values["error_message"] = None

    await connection.execute(update(item_drafts).where(item_drafts.c.id == draft_id).values(**values))
    row.update(values)
    return row


def square_editor_image_variants(content: bytes) -> dict[str, bytes]:
    return {"original": content, "card": content, "thumbnail": content}


def square_mask_variants(content: bytes) -> dict[str, bytes]:
    return {"mask": content, "card": content, "thumbnail": content}


def square_cutout_variants(content: bytes) -> dict[str, bytes]:
    return {"cutout": content, "card": content, "thumbnail": content}


async def save_square_draft_artifacts(
    connection: AsyncConnection,
    user_id: str,
    draft_id: str,
    *,
    square_source_bytes: bytes,
    square_mask_bytes: bytes,
    square_cutout_bytes: bytes,
) -> dict[str, str]:
    editor_file_id = await create_image_file_with_variants(
        connection,
        user_id,
        square_editor_image_variants(square_source_bytes),
        f"editor-{draft_id}.png",
        "image/png",
    )
    mask_file_id = await create_image_file_with_variants(
        connection,
        user_id,
        square_mask_variants(square_mask_bytes),
        f"mask-{draft_id}.png",
        "image/png",
    )
    processed_file_id = await create_image_file_with_variants(
        connection,
        user_id,
        square_cutout_variants(square_cutout_bytes),
        f"cutout-{draft_id}.png",
        "image/png",
    )
    return {
        "editor_file_id": editor_file_id,
        "mask_file_id": mask_file_id,
        "processed_file_id": processed_file_id,
    }


async def _ensure_square_draft_assets(connection: AsyncConnection, row: dict) -> dict:
    if row.get("source_type") not in {"photo", "gallery"}:
        return row
    if row.get("editor_file_id") and row.get("processed_file_id") and row.get("mask_file_id"):
        return row
    if not row.get("original_file_id") or not row.get("mask_file_id"):
        return row

    original_bytes = await get_file_bytes(connection, row.get("original_file_id"), "original")
    mask_bytes = await get_file_bytes(connection, row.get("mask_file_id"), "mask")
    if not original_bytes or not mask_bytes:
        return row

    settings = get_settings()
    prepared_assets = prepare_square_editor_assets(
        original_bytes,
        mask_bytes,
        canvas_size=settings.wardrobe_image_canvas_size,
        padding_ratio=settings.wardrobe_image_padding_ratio,
        min_padding_px=settings.wardrobe_image_min_padding_px,
        alpha_threshold=settings.wardrobe_image_alpha_threshold,
    )
    previous_processed_file_id = row.get("processed_file_id")
    previous_original_file_id = row.get("original_file_id")
    saved_file_ids = await save_square_draft_artifacts(
        connection,
        row["user_id"],
        row["id"],
        square_source_bytes=prepared_assets["square_source_bytes"],
        square_mask_bytes=prepared_assets["square_mask_bytes"],
        square_cutout_bytes=prepared_assets["square_cutout_bytes"],
    )

    payload = dict(row.get("suggested_payload_json") or {})
    primary_image_file_id = payload.get("primaryImageFileId")
    if not primary_image_file_id or primary_image_file_id in {previous_processed_file_id, previous_original_file_id}:
        payload["primaryImageFileId"] = saved_file_ids["processed_file_id"]
    payload.pop("image", None)

    values = {
        **saved_file_ids,
        "suggested_payload_json": payload,
        "updated_at": datetime.now(timezone.utc),
    }
    await connection.execute(update(item_drafts).where(item_drafts.c.id == row["id"]).values(**values))
    row.update(values)
    return row


async def _serialize_draft(connection: AsyncConnection, row: dict) -> DraftResponse:
    row = await _ensure_square_draft_assets(connection, row)
    payload = dict(row.get("suggested_payload_json") or {})
    editor_url = await get_file_url(connection, row.get("editor_file_id"), "card")
    original_url = await get_file_url(connection, row.get("original_file_id"), "original")
    if original_url is None:
        original_url = await get_file_url(connection, row.get("original_file_id"), "card")
    if row.get("source_type") in {"photo", "gallery"} and editor_url:
        original_url = editor_url
    cutout_url = await get_file_url(connection, row.get("processed_file_id"), "card")
    mask_url = await get_file_url(connection, row.get("mask_file_id"), "mask")
    mask_bitmap = await _mask_bitmap_payload(connection, row.get("mask_file_id"))
    original_preview_data_url = await _editor_preview_data_url(
        connection,
        row.get("editor_file_id") if row.get("source_type") in {"photo", "gallery"} else row.get("original_file_id"),
    )

    if row["processing_status"] == PRIMARY_READY_STATUS:
        primary_file_id = payload.get("primaryImageFileId") or row.get("processed_file_id") or row.get("original_file_id")
        if row.get("source_type") in {"photo", "gallery"} and primary_file_id == row.get("original_file_id") and row.get("processed_file_id"):
            primary_file_id = row["processed_file_id"]
        if primary_file_id == row.get("processed_file_id") and cutout_url:
            payload["image"] = cutout_url
        else:
            payload["image"] = await get_file_url(connection, primary_file_id, "card")
        payload["primaryImageFileId"] = primary_file_id

    images = DraftImagesResponse(
        cutout=DraftImageAsset(fileId=row["processed_file_id"], imageUrl=cutout_url) if row.get("processed_file_id") else None,
    )
    return DraftResponse(
        id=row["id"],
        sourceType=row["source_type"],
        processingStatus=row["processing_status"],
        ready=row["processing_status"] == PRIMARY_READY_STATUS,
        draft=payload if row["processing_status"] == PRIMARY_READY_STATUS else None,
        errorMessage=row.get("error_message"),
        images=images,
        editorImageUrl=editor_url,
        originalImageUrl=original_url,
        originalImagePreviewDataUrl=original_preview_data_url,
        maskImageUrl=mask_url,
        maskBitmap=mask_bitmap,
        mlResult=row.get("ml_result_json"),
    )


async def _editor_preview_data_url(connection: AsyncConnection, file_id: str | None) -> str | None:
    preview_bytes = await get_file_bytes(connection, file_id, "original")
    if not preview_bytes:
        return None
    preview_image = Image.open(BytesIO(preview_bytes)).convert("RGBA")
    buffer = BytesIO()
    preview_image.save(buffer, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode('ascii')}"


async def _mask_bitmap_payload(connection: AsyncConnection, mask_file_id: str | None) -> dict | None:
    mask_bytes = await get_file_bytes(connection, mask_file_id, "mask")
    if not mask_bytes:
        return None
    mask = Image.open(BytesIO(mask_bytes)).convert("L")
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


def _apply_mask_strokes(mask: Image.Image, strokes_json: str | None) -> Image.Image:
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
    return mask


def _normalize_strokes(strokes_json: str | None) -> list[dict]:
    if not strokes_json:
        return []
    value = json.loads(strokes_json)
    if not isinstance(value, list):
        raise ValueError("Mask edit strokes must be a list")
    return value


def rebuild_square_draft_assets_from_mask(
    square_source_bytes: bytes,
    existing_mask_bytes: bytes | None,
    edited_mask_bytes: bytes | None,
    *,
    flip_horizontal: bool,
    rotation_degrees: int,
    strokes_json: str | None = None,
) -> tuple[bytes, bytes, bytes]:
    if rotation_degrees not in VALID_MASK_ROTATIONS:
        raise ValueError("rotationDegrees must be one of 0, 90, 180, 270")

    source = Image.open(BytesIO(square_source_bytes)).convert("RGBA")

    if edited_mask_bytes:
        mask = Image.open(BytesIO(edited_mask_bytes)).convert("L")
        if mask.size != source.size:
            mask = mask.resize(source.size, Image.Resampling.LANCZOS)
    elif existing_mask_bytes:
        mask = Image.open(BytesIO(existing_mask_bytes)).convert("L")
        if mask.size != source.size:
            mask = mask.resize(source.size, Image.Resampling.LANCZOS)
    else:
        raise ValueError("Mask image is missing")

    mask = _apply_mask_strokes(mask, strokes_json)
    source = _apply_orientation(source, flip_horizontal, rotation_degrees)
    mask = _apply_orientation(mask, flip_horizontal, rotation_degrees)
    square_source_bytes = _png_bytes(source)
    square_mask_bytes = _png_bytes(mask)
    square_cutout_bytes = compose_square_cutout(square_source_bytes, square_mask_bytes)
    return square_source_bytes, square_mask_bytes, square_cutout_bytes


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
    file_id: str | None = None,
) -> DraftResponse:
    if source_type not in {"photo", "gallery"}:
        raise ValueError("Unsupported draft source type")
    if file_id is None:
        raise ValueError("Original image is required for uploaded drafts")

    draft_payload = _default_draft_payload(source_type, catalog_id, file_id)
    draft_id = new_id("draft")
    await connection.execute(
        insert(item_drafts).values(
            id=draft_id,
            user_id=user_id,
            source_type=source_type,
            processing_status=PRIMARY_QUEUED_STATUS,
            catalog_id=catalog_id,
            original_file_id=file_id,
            editor_file_id=None,
            processed_file_id=None,
            suggested_payload_json=draft_payload,
            started_at=None,
            finished_at=None,
        )
    )
    from app.tasks.wardrobe_tasks import trigger_prepare_item_photo_task

    external_transaction = getattr(connection.sync_connection, "_trans_context_manager", None) is not None
    if external_transaction:
        row = await _load_draft_row(connection, user_id, draft_id)
        return await _serialize_draft(connection, row)

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
    row = await _ensure_square_draft_assets(connection, row)
    if not row.get("editor_file_id"):
        raise ValueError("Draft does not have an editor image")

    square_source_bytes = await get_file_bytes(connection, row["editor_file_id"], "original")
    existing_mask_bytes = await get_file_bytes(connection, row.get("mask_file_id"), "mask")
    if not square_source_bytes:
        raise ValueError("Editor image bytes are unavailable")

    edited_mask_bytes = mask_bytes or pgm_mask_bytes_from_base64(mask_image_base64)
    new_square_source_bytes, new_mask_bytes, cutout_bytes = rebuild_square_draft_assets_from_mask(
        square_source_bytes,
        existing_mask_bytes,
        edited_mask_bytes,
        flip_horizontal=flip_horizontal,
        rotation_degrees=rotation_degrees,
        strokes_json=strokes_json,
    )
    saved_file_ids = await save_square_draft_artifacts(
        connection,
        user_id,
        f"{draft_id}-mask-edit",
        square_source_bytes=new_square_source_bytes,
        square_mask_bytes=new_mask_bytes,
        square_cutout_bytes=cutout_bytes,
    )

    payload = dict(row.get("suggested_payload_json") or {})
    payload["primaryImageFileId"] = saved_file_ids["processed_file_id"]
    payload.pop("image", None)

    await connection.execute(
        update(item_drafts)
        .where(item_drafts.c.id == draft_id, item_drafts.c.user_id == user_id)
        .values(
            editor_file_id=saved_file_ids["editor_file_id"],
            processed_file_id=saved_file_ids["processed_file_id"],
            mask_file_id=saved_file_ids["mask_file_id"],
            suggested_payload_json=payload,
            updated_at=datetime.now(timezone.utc),
        )
    )
    return await get_draft(connection, user_id, draft_id)


def _blank(value: Any) -> bool:
    return not str(value or "").strip()


def _draft_validation_error_from_pydantic(exc: ValidationError) -> str:
    labels: list[str] = []
    for entry in exc.errors():
        location = entry.get("loc") or []
        field_name = next(
            (
                part
                for part in reversed(location)
                if isinstance(part, str) and part in CONFIRM_DRAFT_FIELD_LABELS
            ),
            None,
        )
        if field_name is None:
            continue
        label = CONFIRM_DRAFT_FIELD_LABELS[field_name]
        if label not in labels:
            labels.append(label)

    if labels:
        return f"Заполните обязательные поля: {', '.join(labels)}"
    return "Проверьте данные карточки вещи."


async def _validate_confirm_draft_payload(
    connection: AsyncConnection, user_id: str, row: dict[str, Any], data: dict[str, Any]
) -> None:
    title = str(data.get("title") or "").strip()
    catalog_id = str(data.get("catalogId") or "").strip()
    category_id = str(data.get("categoryId") or "").strip()
    subcategory = str(data.get("subcategory") or "").strip()
    status_code = str(data.get("status") or "").strip()
    primary_image_file_id = str(data.get("primaryImageFileId") or "").strip() or None

    data["title"] = title
    data["catalogId"] = catalog_id
    data["categoryId"] = category_id
    data["subcategory"] = subcategory
    data["status"] = status_code
    data["primaryImageFileId"] = primary_image_file_id

    if _blank(title):
        raise ValueError("Заполните название вещи")
    if _blank(catalog_id):
        raise ValueError("Выберите каталог")
    if _blank(category_id):
        raise ValueError("Выберите категорию")
    if _blank(subcategory):
        raise ValueError("Выберите или введите подкатегорию")
    if _blank(status_code):
        raise ValueError("Выберите статус")

    if row.get("source_type") in {"photo", "gallery"} and primary_image_file_id is None:
        raise ValueError("Выберите изображение вещи")

    allowed_primary_ids = {file_id for file_id in [row.get("processed_file_id")] if file_id}
    if primary_image_file_id and primary_image_file_id not in allowed_primary_ids:
        raise ValueError("Выбранное изображение устарело. Выберите изображение вещи заново")

    category_exists = (
        await connection.execute(select(categories.c.id).where(categories.c.id == category_id))
    ).first()
    if category_exists is None:
        raise ValueError("Выберите корректную категорию")

    catalog_exists = (
        await connection.execute(
            select(wardrobe_catalogs.c.id).where(
                wardrobe_catalogs.c.id == catalog_id,
                wardrobe_catalogs.c.user_id == user_id,
            )
        )
    ).first()
    if catalog_exists is None:
        raise ValueError("Выберите корректный каталог")

    status_exists = (
        await connection.execute(select(item_statuses.c.id).where(item_statuses.c.code == status_code))
    ).first()
    if status_exists is None:
        raise ValueError("Выберите корректный статус")


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
        if override.colorIds is not None and override.colorPrediction is None:
            data.pop("colorPrediction", None)
    await _validate_confirm_draft_payload(connection, user_id, row, data)
    try:
        payload = ItemPayload(**data)
    except ValidationError as exc:
        raise ValueError(_draft_validation_error_from_pydantic(exc)) from exc
    return await create_item(connection, user_id, payload)
