from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import and_, delete, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncConnection

from app.db.database import get_connection
from app.db.metadata import (
    files,
    item_drafts,
    outfit_collection_outfits,
    outfit_collections,
    outfit_items,
    outfit_seasons,
    outfits,
    seasons,
    styles,
    users,
    wardrobe_items,
)
from app.modules.auth.dependencies import get_current_user
from app.modules.files.service import (
    create_file_record,
    get_file_url,
    new_id,
    save_file_variant,
)
from app.modules.outfits.schemas import (
    OutfitCollectionOutfitsPayload,
    OutfitCollectionPatch,
    OutfitCollectionPayload,
    OutfitCollectionRef,
    OutfitCollectionResponse,
    OutfitCoverUploadResponse,
    OutfitPatch,
    OutfitPayload,
    OutfitResponse,
)


router = APIRouter(prefix="/outfits", tags=["outfits"])

MIN_OUTFIT_ITEMS = 2
OUTFIT_COLLECTION_ID_PREFIX = "outfit_col"
OUTFIT_COLLECTION_LINK_ID_PREFIX = "outfit_col_link"


def normalize_name(value: str) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("ё", "е")
    )


def _created_at_iso(value: datetime | str | None) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return ""
    return str(value)


def _clean_title(value: str, *, field_name: str = "Название") -> str:
    title = str(value or "").strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} не может быть пустым")
    return title


async def _style_id(connection: AsyncConnection, user_id: str, tags: list[str]) -> str | None:
    style_name = next((str(tag or "").strip() for tag in tags if str(tag or "").strip()), "")
    if not style_name:
        return None

    normalized = normalize_name(style_name)
    row = (
        await connection.execute(
            select(styles.c.id).where(
                styles.c.normalized_name == normalized,
                or_(styles.c.is_system.is_(True), styles.c.user_id == user_id),
            )
        )
    ).first()
    if row:
        return row[0]

    style_id = new_id("style")
    await connection.execute(
        insert(styles).values(
            id=style_id,
            user_id=user_id,
            name=style_name,
            normalized_name=normalized,
            is_system=False,
        )
    )
    return style_id


async def _season_ids(connection: AsyncConnection, names: list[str]) -> list[str]:
    if not names:
        return []
    rows = (await connection.execute(select(seasons.c.id).where(seasons.c.name.in_(names)))).scalars().all()
    return list(rows)


async def _cover_url(connection: AsyncConnection, file_id: str | None) -> str | None:
    if not file_id:
        return None
    for variant in ["cover", "card", "thumbnail", "original"]:
        url = await get_file_url(connection, file_id, variant)
        if url:
            return url
    return None


async def _cover_transparent_url(connection: AsyncConnection, file_id: str | None) -> str | None:
    if not file_id:
        return None
    return await get_file_url(connection, file_id, "cover_transparent")


async def _serialize_collection(connection: AsyncConnection, user_id: str, row: dict) -> OutfitCollectionResponse:
    outfit_count = (
        await connection.execute(
            select(func.count(func.distinct(outfit_collection_outfits.c.outfit_id)))
            .select_from(
                outfit_collection_outfits.join(
                    outfits,
                    outfits.c.id == outfit_collection_outfits.c.outfit_id,
                )
            )
            .where(
                outfit_collection_outfits.c.collection_id == row["id"],
                outfits.c.user_id == user_id,
            )
        )
    ).scalar_one()

    return OutfitCollectionResponse(
        id=row["id"],
        title=row["name"],
        sortOrder=int(row.get("sort_order") or 0),
        createdAt=_created_at_iso(row.get("created_at")),
        outfitCount=int(outfit_count or 0),
    )


async def _serialize(connection: AsyncConnection, row: dict) -> OutfitResponse:
    item_ids = (
        await connection.execute(
            select(outfit_items.c.item_id)
            .where(outfit_items.c.outfit_id == row["id"])
            .order_by(outfit_items.c.created_at)
        )
    ).scalars().all()
    season_names = (
        await connection.execute(
            select(seasons.c.name)
            .select_from(outfit_seasons.join(seasons, outfit_seasons.c.season_id == seasons.c.id))
            .where(outfit_seasons.c.outfit_id == row["id"])
            .order_by(seasons.c.sort_order, seasons.c.name)
        )
    ).scalars().all()
    collection_rows = (
        await connection.execute(
            select(outfit_collections.c.id, outfit_collections.c.name)
            .select_from(
                outfit_collection_outfits.join(
                    outfit_collections,
                    outfit_collections.c.id == outfit_collection_outfits.c.collection_id,
                )
            )
            .where(outfit_collection_outfits.c.outfit_id == row["id"])
            .order_by(outfit_collections.c.sort_order, outfit_collections.c.name)
        )
    ).mappings().all()

    tags: list[str] = []
    if row.get("style_id"):
        style_name = (
            await connection.execute(
                select(styles.c.name).where(styles.c.id == row["style_id"])
            )
        ).scalar_one_or_none()
        if style_name:
            tags.append(style_name)

    cover_file_id = row.get("cover_file_id")
    collections = [
        OutfitCollectionRef(id=collection["id"], title=collection["name"])
        for collection in collection_rows
    ]

    return OutfitResponse(
        id=row["id"],
        title=row["name"],
        description=row.get("description") or "",
        itemIds=list(item_ids),
        tags=tags,
        season=list(season_names),
        collectionIds=[collection.id for collection in collections],
        collections=collections,
        createdAt=_created_at_iso(row.get("created_at")),
        coverMode=(row.get("cover_mode") or "none"),
        coverFileId=cover_file_id,
        coverImageUrl=await _cover_url(connection, cover_file_id),
        coverTransparentImageUrl=await _cover_transparent_url(connection, cover_file_id),
        coverEditorStateJson=row.get("cover_editor_state_json"),
    )


async def _validated_item_ids(
    connection: AsyncConnection,
    user_id: str,
    item_ids: list[str],
) -> list[str]:
    unique_ids = list(dict.fromkeys(item_id for item_id in item_ids if item_id))
    if len(unique_ids) < MIN_OUTFIT_ITEMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для образа нужно выбрать минимум 2 вещи",
        )

    owned_rows = (
        await connection.execute(
            select(wardrobe_items.c.id).where(
                wardrobe_items.c.user_id == user_id,
                wardrobe_items.c.id.in_(unique_ids),
            )
        )
    ).scalars().all()
    owned = set(owned_rows)
    missing = [item_id for item_id in unique_ids if item_id not in owned]

    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some outfit items do not belong to current user or do not exist",
        )

    return unique_ids


async def _validated_collection_ids(
    connection: AsyncConnection,
    user_id: str,
    collection_ids: list[str],
) -> list[str]:
    unique_ids = list(dict.fromkeys(collection_id for collection_id in collection_ids if collection_id))
    if not unique_ids:
        return []

    owned_rows = (
        await connection.execute(
            select(outfit_collections.c.id).where(
                outfit_collections.c.user_id == user_id,
                outfit_collections.c.id.in_(unique_ids),
            )
        )
    ).scalars().all()
    owned = set(owned_rows)
    missing = [collection_id for collection_id in unique_ids if collection_id not in owned]

    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some outfit collections do not belong to current user or do not exist",
        )

    return unique_ids


async def _validated_outfit_ids(
    connection: AsyncConnection,
    user_id: str,
    outfit_ids: list[str],
) -> list[str]:
    unique_ids = list(dict.fromkeys(outfit_id for outfit_id in outfit_ids if outfit_id))
    if not unique_ids:
        return []

    owned_rows = (
        await connection.execute(
            select(outfits.c.id).where(
                outfits.c.user_id == user_id,
                outfits.c.id.in_(unique_ids),
            )
        )
    ).scalars().all()
    owned = set(owned_rows)
    missing = [outfit_id for outfit_id in unique_ids if outfit_id not in owned]

    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some outfits do not belong to current user or do not exist",
        )

    return unique_ids


async def _collection_row(
    connection: AsyncConnection,
    user_id: str,
    collection_id: str,
) -> dict:
    row = (
        await connection.execute(
            select(outfit_collections).where(
                outfit_collections.c.id == collection_id,
                outfit_collections.c.user_id == user_id,
            )
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Подборка не найдена")
    return dict(row)


async def _replace_links(
    connection: AsyncConnection,
    outfit_id: str,
    item_ids: list[str],
    season_names: list[str],
    collection_ids: list[str],
) -> None:
    await connection.execute(delete(outfit_items).where(outfit_items.c.outfit_id == outfit_id))
    await connection.execute(delete(outfit_seasons).where(outfit_seasons.c.outfit_id == outfit_id))
    await connection.execute(
        delete(outfit_collection_outfits).where(outfit_collection_outfits.c.outfit_id == outfit_id)
    )

    if item_ids:
        await connection.execute(
            insert(outfit_items),
            [
                {
                    "id": new_id("outfit_item"),
                    "outfit_id": outfit_id,
                    "item_id": item_id,
                    "role_code": "item",
                }
                for item_id in item_ids
            ],
        )

    season_ids = await _season_ids(connection, season_names)
    if season_ids:
        await connection.execute(
            insert(outfit_seasons),
            [
                {
                    "id": new_id("outfit_season"),
                    "outfit_id": outfit_id,
                    "season_id": season_id,
                }
                for season_id in season_ids
            ],
        )

    if collection_ids:
        await connection.execute(
            insert(outfit_collection_outfits),
            [
                {
                    "id": new_id(OUTFIT_COLLECTION_LINK_ID_PREFIX),
                    "outfit_id": outfit_id,
                    "collection_id": collection_id,
                }
                for collection_id in collection_ids
            ],
        )


@router.get("/collections", response_model=list[OutfitCollectionResponse])
async def list_outfit_collections(
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
):
    rows = (
        await connection.execute(
            select(outfit_collections)
            .where(outfit_collections.c.user_id == current_user["id"])
            .order_by(outfit_collections.c.sort_order, outfit_collections.c.name)
        )
    ).mappings().all()
    return [await _serialize_collection(connection, current_user["id"], dict(row)) for row in rows]


@router.post("/collections", response_model=OutfitCollectionResponse)
async def create_outfit_collection(
    payload: OutfitCollectionPayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
):
    title = _clean_title(payload.title, field_name="Название подборки")
    normalized = normalize_name(title)

    existing = (
        await connection.execute(
            select(outfit_collections.c.id).where(
                outfit_collections.c.user_id == current_user["id"],
                outfit_collections.c.normalized_name == normalized,
            )
        )
    ).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Подборка уже существует")

    count = (
        await connection.execute(
            select(func.count()).select_from(outfit_collections).where(outfit_collections.c.user_id == current_user["id"])
        )
    ).scalar_one()
    collection_id = new_id(OUTFIT_COLLECTION_ID_PREFIX)

    await connection.execute(
        insert(outfit_collections).values(
            id=collection_id,
            user_id=current_user["id"],
            name=title,
            normalized_name=normalized,
            sort_order=(int(count or 0) + 1) * 10,
        )
    )
    row = await _collection_row(connection, current_user["id"], collection_id)
    return await _serialize_collection(connection, current_user["id"], row)


@router.patch("/collections/{collection_id}", response_model=OutfitCollectionResponse)
async def patch_outfit_collection(
    collection_id: str,
    payload: OutfitCollectionPatch,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
):
    current = await _collection_row(connection, current_user["id"], collection_id)
    title = _clean_title(payload.title, field_name="Название подборки")
    normalized = normalize_name(title)

    if normalized != current.get("normalized_name"):
        conflict = (
            await connection.execute(
                select(outfit_collections.c.id).where(
                    outfit_collections.c.id != collection_id,
                    outfit_collections.c.user_id == current_user["id"],
                    outfit_collections.c.normalized_name == normalized,
                )
            )
        ).first()
        if conflict is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Подборка уже существует")

    await connection.execute(
        update(outfit_collections)
        .where(
            outfit_collections.c.id == collection_id,
            outfit_collections.c.user_id == current_user["id"],
        )
        .values(name=title, normalized_name=normalized)
    )
    row = await _collection_row(connection, current_user["id"], collection_id)
    return await _serialize_collection(connection, current_user["id"], row)


@router.delete("/collections/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_outfit_collection(
    collection_id: str,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> None:
    await _collection_row(connection, current_user["id"], collection_id)
    await connection.execute(
        delete(outfit_collections).where(
            outfit_collections.c.id == collection_id,
            outfit_collections.c.user_id == current_user["id"],
        )
    )


@router.post("/collections/{collection_id}/outfits", response_model=OutfitCollectionResponse)
async def add_outfits_to_collection(
    collection_id: str,
    payload: OutfitCollectionOutfitsPayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
):
    row = await _collection_row(connection, current_user["id"], collection_id)
    outfit_ids = await _validated_outfit_ids(connection, current_user["id"], payload.outfitIds)

    if outfit_ids:
        existing_ids = set(
            (
                await connection.execute(
                    select(outfit_collection_outfits.c.outfit_id).where(
                        outfit_collection_outfits.c.collection_id == collection_id,
                        outfit_collection_outfits.c.outfit_id.in_(outfit_ids),
                    )
                )
            ).scalars().all()
        )
        missing_ids = [outfit_id for outfit_id in outfit_ids if outfit_id not in existing_ids]
        if missing_ids:
            await connection.execute(
                insert(outfit_collection_outfits),
                [
                    {
                        "id": new_id(OUTFIT_COLLECTION_LINK_ID_PREFIX),
                        "outfit_id": outfit_id,
                        "collection_id": collection_id,
                    }
                    for outfit_id in missing_ids
                ],
            )

    return await _serialize_collection(connection, current_user["id"], row)


@router.delete("/collections/{collection_id}/outfits/{outfit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_outfit_from_collection(
    collection_id: str,
    outfit_id: str,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> None:
    await _collection_row(connection, current_user["id"], collection_id)
    owned_outfit = (
        await connection.execute(
            select(outfits.c.id).where(
                outfits.c.id == outfit_id,
                outfits.c.user_id == current_user["id"],
            )
        )
    ).first()
    if owned_outfit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Образ не найден")

    await connection.execute(
        delete(outfit_collection_outfits).where(
            outfit_collection_outfits.c.collection_id == collection_id,
            outfit_collection_outfits.c.outfit_id == outfit_id,
        )
    )


@router.get("", response_model=list[OutfitResponse])
async def list_outfits(
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
):
    rows = (
        await connection.execute(
            select(outfits)
            .where(outfits.c.user_id == current_user["id"])
            .order_by(outfits.c.created_at.desc())
        )
    ).mappings().all()
    return [await _serialize(connection, dict(row)) for row in rows]


@router.post("", response_model=OutfitResponse)
async def create_outfit(
    payload: OutfitPayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
):
    outfit_id = new_id("outfit")
    item_ids = await _validated_item_ids(connection, current_user["id"], payload.itemIds)
    collection_ids = await _validated_collection_ids(connection, current_user["id"], payload.collectionIds)

    await connection.execute(
        insert(outfits).values(
            id=outfit_id,
            user_id=current_user["id"],
            name=_clean_title(payload.title),
            description=payload.description,
            style_id=await _style_id(connection, current_user["id"], payload.tags),
            cover_file_id=payload.coverFileId,
            cover_mode=payload.coverMode,
            cover_editor_state_json=payload.coverEditorStateJson,
        )
    )
    await _replace_links(connection, outfit_id, item_ids, payload.season, collection_ids)
    row = (
        await connection.execute(
            select(outfits).where(
                outfits.c.id == outfit_id,
                outfits.c.user_id == current_user["id"],
            )
        )
    ).mappings().first()
    return await _serialize(connection, dict(row))


@router.post("/covers/upload", response_model=OutfitCoverUploadResponse)
async def upload_outfit_cover(
    mode: str = Form("gallery"),
    cover: UploadFile = File(...),
    transparentCover: UploadFile | None = File(None),
    thumbnail: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
):
    if mode not in {"gallery", "composition"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported cover mode")

    cover_bytes = await cover.read()
    if not cover_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cover image is empty")

    file_id = await create_file_record(
        connection,
        filename=cover.filename or "outfit-cover",
        mime_type=cover.content_type or "application/octet-stream",
    )

    cover_mime = cover.content_type or "image/jpeg"
    thumb_bytes = cover_bytes
    thumb_mime = cover_mime
    if thumbnail is not None:
        uploaded_thumb_bytes = await thumbnail.read()
        if uploaded_thumb_bytes:
            thumb_bytes = uploaded_thumb_bytes
            thumb_mime = thumbnail.content_type or "image/jpeg"

    await save_file_variant(connection, current_user["id"], file_id, "original", cover_bytes, cover_mime)
    await save_file_variant(connection, current_user["id"], file_id, "cover", cover_bytes, cover_mime)
    await save_file_variant(connection, current_user["id"], file_id, "card", thumb_bytes, thumb_mime)
    await save_file_variant(connection, current_user["id"], file_id, "thumbnail", thumb_bytes, thumb_mime)

    if transparentCover is not None:
        transparent_bytes = await transparentCover.read()
        if transparent_bytes:
            await save_file_variant(
                connection,
                current_user["id"],
                file_id,
                "cover_transparent",
                transparent_bytes,
                transparentCover.content_type or "image/png",
            )

    return OutfitCoverUploadResponse(
        fileId=file_id,
        coverImageUrl=await _cover_url(connection, file_id),
        coverTransparentImageUrl=await _cover_transparent_url(connection, file_id),
    )


@router.get("/{outfit_id}", response_model=OutfitResponse)
async def get_outfit(
    outfit_id: str,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
):
    row = (
        await connection.execute(
            select(outfits).where(
                outfits.c.id == outfit_id,
                outfits.c.user_id == current_user["id"],
            )
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outfit not found")
    return await _serialize(connection, dict(row))


@router.patch("/{outfit_id}", response_model=OutfitResponse)
async def patch_outfit(
    outfit_id: str,
    payload: OutfitPatch,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
):
    current = await get_outfit(outfit_id, current_user, connection)
    provided = payload.model_fields_set
    merged = OutfitPayload(
        title=payload.title if payload.title is not None else current.title,
        description=payload.description if payload.description is not None else current.description,
        itemIds=payload.itemIds if payload.itemIds is not None else current.itemIds,
        tags=payload.tags if payload.tags is not None else current.tags,
        season=payload.season if payload.season is not None else current.season,
        collectionIds=payload.collectionIds if payload.collectionIds is not None else current.collectionIds,
        coverMode=payload.coverMode if "coverMode" in provided else current.coverMode,
        coverFileId=payload.coverFileId if "coverFileId" in provided else current.coverFileId,
        coverEditorStateJson=payload.coverEditorStateJson if "coverEditorStateJson" in provided else current.coverEditorStateJson,
    )
    item_ids = await _validated_item_ids(connection, current_user["id"], merged.itemIds)
    collection_ids = await _validated_collection_ids(connection, current_user["id"], merged.collectionIds)

    await connection.execute(
        update(outfits)
        .where(outfits.c.id == outfit_id, outfits.c.user_id == current_user["id"])
        .values(
            name=_clean_title(merged.title),
            description=merged.description,
            style_id=await _style_id(connection, current_user["id"], merged.tags),
            cover_file_id=merged.coverFileId,
            cover_mode=merged.coverMode,
            cover_editor_state_json=merged.coverEditorStateJson,
        )
    )
    await _replace_links(connection, outfit_id, item_ids, merged.season, collection_ids)
    return await get_outfit(outfit_id, current_user, connection)


@router.delete("/{outfit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_outfit(
    outfit_id: str,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> None:
    row = (
        await connection.execute(
            select(outfits.c.id, outfits.c.cover_file_id).where(
                outfits.c.id == outfit_id,
                outfits.c.user_id == current_user["id"],
            )
        )
    ).mappings().first()
    if row is None:
        return

    cover_file_id = row.get("cover_file_id")
    await connection.execute(
        delete(outfits).where(
            outfits.c.id == outfit_id,
            outfits.c.user_id == current_user["id"],
        )
    )

    if not cover_file_id:
        return

    outfit_refs = (
        await connection.execute(
            select(func.count())
            .select_from(outfits)
            .where(outfits.c.cover_file_id == cover_file_id)
        )
    ).scalar_one()
    user_refs = (
        await connection.execute(
            select(func.count())
            .select_from(users)
            .where(users.c.avatar_file_id == cover_file_id)
        )
    ).scalar_one()
    item_refs = (
        await connection.execute(
            select(func.count())
            .select_from(wardrobe_items)
            .where(wardrobe_items.c.primary_image_file_id == cover_file_id)
        )
    ).scalar_one()
    draft_refs = (
        await connection.execute(
            select(func.count())
            .select_from(item_drafts)
            .where(
                or_(
                    item_drafts.c.original_file_id == cover_file_id,
                    item_drafts.c.processed_file_id == cover_file_id,
                    item_drafts.c.mask_file_id == cover_file_id,
                    item_drafts.c.catalog_file_id == cover_file_id,
                )
            )
        )
    ).scalar_one()

    if outfit_refs == 0 and user_refs == 0 and item_refs == 0 and draft_refs == 0:
        await connection.execute(delete(files).where(files.c.id == cover_file_id))
