from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncConnection

from app.db.database import get_connection
from app.db.metadata import (
    files,
    item_drafts,
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
    OutfitCoverUploadResponse,
    OutfitPatch,
    OutfitPayload,
    OutfitResponse,
)


router = APIRouter(prefix="/outfits", tags=["outfits"])


async def _style_id(connection: AsyncConnection, tags: list[str]) -> str | None:
    if not tags:
        return None
    row = (await connection.execute(select(styles.c.id).where(styles.c.name == tags[0]))).first()
    return row[0] if row else None


async def _season_ids(connection: AsyncConnection, names: list[str]) -> list[str]:
    if not names:
        return []
    rows = (await connection.execute(select(seasons.c.id).where(seasons.c.name.in_(names)))).scalars().all()
    return list(rows)


def _created_at_iso(value: datetime | str | None) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return ""
    return str(value)


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
        )
    ).scalars().all()

    tag_names = []
    if row.get("style_id"):
        style = (await connection.execute(select(styles.c.name).where(styles.c.id == row["style_id"]))).scalar_one_or_none()
        if style:
            tag_names.append(style)

    cover_file_id = row.get("cover_file_id")

    return OutfitResponse(
        id=row["id"],
        title=row["name"],
        description=row.get("description") or "",
        itemIds=list(item_ids),
        tags=tag_names,
        season=list(season_names),
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
    unique_ids = list(dict.fromkeys(item_ids))
    if not unique_ids:
        return []

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


async def _replace_links(
    connection: AsyncConnection,
    outfit_id: str,
    item_ids: list[str],
    season_names: list[str],
) -> None:
    await connection.execute(delete(outfit_items).where(outfit_items.c.outfit_id == outfit_id))
    await connection.execute(delete(outfit_seasons).where(outfit_seasons.c.outfit_id == outfit_id))

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


@router.post("", response_model=OutfitResponse)
async def create_outfit(
    payload: OutfitPayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
):
    outfit_id = new_id("outfit")
    validated_item_ids = await _validated_item_ids(connection, current_user["id"], payload.itemIds)

    await connection.execute(
        insert(outfits).values(
            id=outfit_id,
            user_id=current_user["id"],
            name=payload.title.strip(),
            description=payload.description,
            style_id=await _style_id(connection, payload.tags),
            cover_file_id=payload.coverFileId,
            cover_mode=payload.coverMode,
            cover_editor_state_json=payload.coverEditorStateJson,
        )
    )
    await _replace_links(connection, outfit_id, validated_item_ids, payload.season)
    return await get_outfit(outfit_id, current_user, connection)


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
        coverMode=payload.coverMode if "coverMode" in provided else current.coverMode,
        coverFileId=payload.coverFileId if "coverFileId" in provided else current.coverFileId,
        coverEditorStateJson=payload.coverEditorStateJson if "coverEditorStateJson" in provided else current.coverEditorStateJson,
    )
    validated_item_ids = await _validated_item_ids(connection, current_user["id"], merged.itemIds)

    await connection.execute(
        update(outfits)
        .where(outfits.c.id == outfit_id, outfits.c.user_id == current_user["id"])
        .values(
            name=merged.title.strip(),
            description=merged.description,
            style_id=await _style_id(connection, merged.tags),
            cover_file_id=merged.coverFileId,
            cover_mode=merged.coverMode,
            cover_editor_state_json=merged.coverEditorStateJson,
        )
    )
    await _replace_links(connection, outfit_id, validated_item_ids, merged.season)
    return await get_outfit(outfit_id, current_user, connection)


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
