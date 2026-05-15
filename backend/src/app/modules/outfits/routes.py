from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncConnection

from app.db.database import get_connection
from app.db.metadata import outfit_items, outfit_seasons, outfits, seasons, styles
from app.modules.auth.dependencies import get_current_user
from app.modules.files.service import new_id
from app.modules.outfits.schemas import OutfitPatch, OutfitPayload, OutfitResponse


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


async def _serialize(connection: AsyncConnection, row: dict) -> OutfitResponse:
    item_ids = (
        await connection.execute(select(outfit_items.c.item_id).where(outfit_items.c.outfit_id == row["id"]).order_by(outfit_items.c.created_at))
    ).scalars().all()
    season_names = (
        await connection.execute(
            select(seasons.c.name).select_from(outfit_seasons.join(seasons, outfit_seasons.c.season_id == seasons.c.id)).where(outfit_seasons.c.outfit_id == row["id"])
        )
    ).scalars().all()
    tag_names = []
    if row.get("style_id"):
        style = (await connection.execute(select(styles.c.name).where(styles.c.id == row["style_id"]))).scalar_one_or_none()
        if style:
            tag_names.append(style)
    return OutfitResponse(
        id=row["id"],
        title=row["name"],
        description=row.get("description") or "",
        itemIds=list(item_ids),
        tags=tag_names,
        season=list(season_names),
    )


async def _replace_links(connection: AsyncConnection, outfit_id: str, item_ids: list[str], season_names: list[str]) -> None:
    await connection.execute(delete(outfit_items).where(outfit_items.c.outfit_id == outfit_id))
    await connection.execute(delete(outfit_seasons).where(outfit_seasons.c.outfit_id == outfit_id))
    if item_ids:
        await connection.execute(
            insert(outfit_items),
            [{"id": new_id("outfit_item"), "outfit_id": outfit_id, "item_id": item_id, "role_code": "item"} for item_id in item_ids],
        )
    season_ids = await _season_ids(connection, season_names)
    if season_ids:
        await connection.execute(
            insert(outfit_seasons),
            [{"id": new_id("outfit_season"), "outfit_id": outfit_id, "season_id": season_id} for season_id in season_ids],
        )


@router.get("", response_model=list[OutfitResponse])
async def list_outfits(current_user: dict = Depends(get_current_user), connection: AsyncConnection = Depends(get_connection)):
    rows = (await connection.execute(select(outfits).where(outfits.c.user_id == current_user["id"]).order_by(outfits.c.created_at.desc()))).mappings().all()
    return [await _serialize(connection, dict(row)) for row in rows]


@router.get("/{outfit_id}", response_model=OutfitResponse)
async def get_outfit(outfit_id: str, current_user: dict = Depends(get_current_user), connection: AsyncConnection = Depends(get_connection)):
    row = (await connection.execute(select(outfits).where(outfits.c.id == outfit_id, outfits.c.user_id == current_user["id"]))).mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outfit not found")
    return await _serialize(connection, dict(row))


@router.post("", response_model=OutfitResponse)
async def create_outfit(payload: OutfitPayload, current_user: dict = Depends(get_current_user), connection: AsyncConnection = Depends(get_connection)):
    outfit_id = new_id("outfit")
    await connection.execute(
        insert(outfits).values(
            id=outfit_id,
            user_id=current_user["id"],
            name=payload.title.strip(),
            description=payload.description,
            style_id=await _style_id(connection, payload.tags),
        )
    )
    await _replace_links(connection, outfit_id, payload.itemIds, payload.season)
    return await get_outfit(outfit_id, current_user, connection)


@router.patch("/{outfit_id}", response_model=OutfitResponse)
async def patch_outfit(outfit_id: str, payload: OutfitPatch, current_user: dict = Depends(get_current_user), connection: AsyncConnection = Depends(get_connection)):
    current = await get_outfit(outfit_id, current_user, connection)
    merged = OutfitPayload(
        title=payload.title if payload.title is not None else current.title,
        description=payload.description if payload.description is not None else current.description,
        itemIds=payload.itemIds if payload.itemIds is not None else current.itemIds,
        tags=payload.tags if payload.tags is not None else current.tags,
        season=payload.season if payload.season is not None else current.season,
    )
    await connection.execute(
        update(outfits)
        .where(outfits.c.id == outfit_id, outfits.c.user_id == current_user["id"])
        .values(name=merged.title.strip(), description=merged.description, style_id=await _style_id(connection, merged.tags))
    )
    await _replace_links(connection, outfit_id, merged.itemIds, merged.season)
    return await get_outfit(outfit_id, current_user, connection)


@router.delete("/{outfit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_outfit(outfit_id: str, current_user: dict = Depends(get_current_user), connection: AsyncConnection = Depends(get_connection)) -> None:
    await connection.execute(delete(outfits).where(outfits.c.id == outfit_id, outfits.c.user_id == current_user["id"]))

