from datetime import date, datetime, time, timezone

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncConnection

from app.db.metadata import (
    item_wear_logs,
    outfit_calendar_entries,
    outfit_items,
    outfit_seasons,
    outfit_wear_logs,
    outfits,
    seasons,
    styles,
    wardrobe_items,
)
from app.modules.calendar.schemas import (
    CalendarEntryResponse,
    ItemWearLogResponse,
    OutfitPreview,
    OutfitWearLogResponse,
    WardrobeItemPreview,
    WearHistoryResponse,
)
from app.modules.files.service import get_file_url, new_id


CALENDAR_SOURCE = "calendar_confirmation"


def _iso_datetime(value: datetime | str | None) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return ""
    return str(value)


def _worn_at(value: date | None) -> datetime | None:
    if value is None:
        return None
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


async def _owned_outfit_row(connection: AsyncConnection, user_id: str, outfit_id: str) -> dict:
    row = (
        await connection.execute(
            select(outfits).where(
                outfits.c.id == outfit_id,
                outfits.c.user_id == user_id,
            )
        )
    ).mappings().first()
    if row is None:
        raise LookupError("Outfit not found")
    return dict(row)


async def _owned_item_rows(connection: AsyncConnection, user_id: str, item_ids: list[str]) -> list[dict]:
    unique_ids = list(dict.fromkeys(item_id for item_id in item_ids if item_id))
    if not unique_ids:
        raise ValueError("At least one item must be selected")

    rows = (
        await connection.execute(
            select(wardrobe_items).where(
                wardrobe_items.c.user_id == user_id,
                wardrobe_items.c.id.in_(unique_ids),
            )
        )
    ).mappings().all()
    items = [dict(row) for row in rows]
    found_ids = {row["id"] for row in items}
    missing = [item_id for item_id in unique_ids if item_id not in found_ids]
    if missing:
        raise LookupError("Item not found")
    return items


async def _outfit_item_ids(connection: AsyncConnection, outfit_id: str) -> list[str]:
    return list(
        (
            await connection.execute(
                select(outfit_items.c.item_id)
                .where(outfit_items.c.outfit_id == outfit_id)
                .order_by(outfit_items.c.created_at, outfit_items.c.item_id)
            )
        ).scalars().all()
    )


async def _outfit_season_names(connection: AsyncConnection, outfit_id: str) -> list[str]:
    return list(
        (
            await connection.execute(
                select(seasons.c.name)
                .select_from(outfit_seasons.join(seasons, outfit_seasons.c.season_id == seasons.c.id))
                .where(outfit_seasons.c.outfit_id == outfit_id)
                .order_by(seasons.c.sort_order, seasons.c.name)
            )
        ).scalars().all()
    )


async def _outfit_tags(connection: AsyncConnection, style_id: str | None) -> list[str]:
    if not style_id:
        return []
    style_name = (await connection.execute(select(styles.c.name).where(styles.c.id == style_id))).scalar_one_or_none()
    return [style_name] if style_name else []


async def _calendar_item_ids(connection: AsyncConnection, calendar_entry_id: str) -> list[str]:
    rows = (
        await connection.execute(
            select(item_wear_logs.c.item_id)
            .where(item_wear_logs.c.calendar_entry_id == calendar_entry_id)
            .order_by(item_wear_logs.c.created_at, item_wear_logs.c.item_id)
        )
    ).scalars().all()
    return list(dict.fromkeys(rows))


async def _item_preview(connection: AsyncConnection, row: dict) -> WardrobeItemPreview:
    return WardrobeItemPreview(
        id=row["id"],
        title=row["name"],
        category_id=row["category_id"],
        subcategory="",
        image_url=await get_file_url(connection, row.get("primary_image_file_id"), "card"),
    )


async def _calendar_item_previews(connection: AsyncConnection, user_id: str, item_ids: list[str]) -> list[WardrobeItemPreview]:
    item_rows = await _owned_item_rows(connection, user_id, item_ids)
    item_by_id = {row["id"]: row for row in item_rows}
    previews = []
    for item_id in item_ids:
        row = item_by_id.get(item_id)
        if row is None:
            continue
        previews.append(await _item_preview(connection, row))
    return previews


async def serialize_outfit_preview(connection: AsyncConnection, row: dict | None) -> OutfitPreview | None:
    if row is None:
        return None
    outfit_id = row["id"]
    return OutfitPreview(
        id=outfit_id,
        title=row["name"],
        item_ids=await _outfit_item_ids(connection, outfit_id),
        tags=await _outfit_tags(connection, row.get("style_id")),
        season=await _outfit_season_names(connection, outfit_id),
        cover_image_url=await get_file_url(connection, row.get("cover_file_id"), "cover"),
        cover_transparent_image_url=await get_file_url(connection, row.get("cover_file_id"), "cover_transparent"),
    )


def _normalized_status(row: dict) -> str:
    if row.get("outfit_id"):
        return "planned"
    return "planned"


async def _calendar_row_by_date(connection: AsyncConnection, user_id: str, target_date: date) -> dict | None:
    row = (
        await connection.execute(
            select(outfit_calendar_entries).where(
                outfit_calendar_entries.c.user_id == user_id,
                outfit_calendar_entries.c.date == target_date,
            )
        )
    ).mappings().first()
    return dict(row) if row is not None else None


async def _upsert_calendar_row(
    connection: AsyncConnection,
    user_id: str,
    target_date: date,
    *,
    outfit_id: str | None,
    weather_snapshot_json: dict | None,
) -> dict:
    existing = await _calendar_row_by_date(connection, user_id, target_date)
    values = {
        "outfit_id": outfit_id,
        "status": "planned",
        "weather_snapshot_json": weather_snapshot_json,
        "updated_at": datetime.now(timezone.utc),
    }
    if existing is None:
        await connection.execute(
            insert(outfit_calendar_entries).values(
                id=new_id("calendar_entry"),
                user_id=user_id,
                date=target_date,
                created_at=datetime.now(timezone.utc),
                **values,
            )
        )
    else:
        await connection.execute(
            update(outfit_calendar_entries)
            .where(outfit_calendar_entries.c.id == existing["id"])
            .values(**values)
        )
    row = await _calendar_row_by_date(connection, user_id, target_date)
    return row


async def serialize_calendar_entry(connection: AsyncConnection, row: dict) -> CalendarEntryResponse:
    outfit_row = None
    item_previews: list[WardrobeItemPreview] = []
    if row.get("outfit_id"):
        outfit_row = await _owned_outfit_row(connection, row["user_id"], row["outfit_id"])
    else:
        item_ids = await _calendar_item_ids(connection, row["id"])
        item_previews = await _calendar_item_previews(connection, row["user_id"], item_ids)
    return CalendarEntryResponse(
        id=row["id"],
        date=row["date"],
        status=_normalized_status(row),
        weather_snapshot_json=row.get("weather_snapshot_json"),
        outfit=await serialize_outfit_preview(connection, outfit_row),
        items=item_previews,
        has_content=bool(outfit_row or item_previews),
    )


async def list_calendar_entries(
    connection: AsyncConnection,
    user_id: str,
    date_from: date,
    date_to: date,
) -> list[CalendarEntryResponse]:
    if date_from > date_to:
        raise ValueError("date_from must be less than or equal to date_to")
    rows = (
        await connection.execute(
            select(outfit_calendar_entries)
            .where(
                outfit_calendar_entries.c.user_id == user_id,
                outfit_calendar_entries.c.date >= date_from,
                outfit_calendar_entries.c.date <= date_to,
            )
            .order_by(outfit_calendar_entries.c.date)
        )
    ).mappings().all()
    return [await serialize_calendar_entry(connection, dict(row)) for row in rows]


async def get_calendar_entry_for_day(
    connection: AsyncConnection,
    user_id: str,
    target_date: date,
) -> CalendarEntryResponse | None:
    row = await _calendar_row_by_date(connection, user_id, target_date)
    if row is None:
        return None
    return await serialize_calendar_entry(connection, row)


async def _recompute_last_worn_for_items(connection: AsyncConnection, item_ids: list[str]) -> None:
    unique_ids = list(dict.fromkeys(item_id for item_id in item_ids if item_id))
    if not unique_ids:
        return

    for item_id in unique_ids:
        latest_date = (
            await connection.execute(
                select(func.max(item_wear_logs.c.worn_date)).where(item_wear_logs.c.item_id == item_id)
            )
        ).scalar_one()
        await connection.execute(
            update(wardrobe_items)
            .where(wardrobe_items.c.id == item_id)
            .values(last_worn_at=_worn_at(latest_date))
        )


async def _delete_entry_wear_logs(
    connection: AsyncConnection,
    user_id: str,
    *,
    target_date: date,
    calendar_entry_id: str | None,
) -> None:
    item_rows = (
        await connection.execute(
            select(item_wear_logs.c.item_id).where(
                item_wear_logs.c.user_id == user_id,
                item_wear_logs.c.worn_date == target_date,
                item_wear_logs.c.calendar_entry_id == calendar_entry_id,
            )
        )
    ).scalars().all()

    await connection.execute(
        delete(outfit_wear_logs).where(
            outfit_wear_logs.c.user_id == user_id,
            outfit_wear_logs.c.worn_date == target_date,
            outfit_wear_logs.c.calendar_entry_id == calendar_entry_id,
        )
    )
    await connection.execute(
        delete(item_wear_logs).where(
            item_wear_logs.c.user_id == user_id,
            item_wear_logs.c.worn_date == target_date,
            item_wear_logs.c.calendar_entry_id == calendar_entry_id,
        )
    )
    await _recompute_last_worn_for_items(connection, list(item_rows))


async def _create_calendar_assignment_logs(
    connection: AsyncConnection,
    user_id: str,
    *,
    target_date: date,
    calendar_entry_id: str,
    outfit_id: str,
    weather_snapshot_json: dict | None,
) -> None:
    item_ids = await _outfit_item_ids(connection, outfit_id)
    now = datetime.now(timezone.utc)

    await connection.execute(
        insert(outfit_wear_logs).values(
            id=new_id("outfit_wear_log"),
            user_id=user_id,
            outfit_id=outfit_id,
            worn_date=target_date,
            calendar_entry_id=calendar_entry_id,
            source=CALENDAR_SOURCE,
            weather_snapshot_json=weather_snapshot_json,
            created_at=now,
        )
    )

    if item_ids:
        await connection.execute(
            insert(item_wear_logs),
            [
                {
                    "id": new_id("item_wear_log"),
                    "user_id": user_id,
                    "item_id": item_id,
                    "outfit_id": outfit_id,
                    "calendar_entry_id": calendar_entry_id,
                    "worn_date": target_date,
                    "source": CALENDAR_SOURCE,
                    "created_at": now,
                }
                for item_id in item_ids
            ],
        )
        await connection.execute(
            update(wardrobe_items)
            .where(wardrobe_items.c.id.in_(item_ids))
            .values(last_worn_at=_worn_at(target_date))
        )


async def upsert_calendar_entry(
    connection: AsyncConnection,
    user_id: str,
    target_date: date,
    outfit_id: str,
    weather_snapshot_json: dict | None = None,
) -> CalendarEntryResponse:
    await _owned_outfit_row(connection, user_id, outfit_id)
    existing = await _calendar_row_by_date(connection, user_id, target_date)

    if existing is not None:
        await _delete_entry_wear_logs(
            connection,
            user_id,
            target_date=target_date,
            calendar_entry_id=existing["id"],
        )

    row = await _upsert_calendar_row(
        connection,
        user_id,
        target_date,
        outfit_id=outfit_id,
        weather_snapshot_json=weather_snapshot_json if weather_snapshot_json is not None else existing.get("weather_snapshot_json") if existing else None,
    )
    await _create_calendar_assignment_logs(
        connection,
        user_id,
        target_date=target_date,
        calendar_entry_id=row["id"],
        outfit_id=outfit_id,
        weather_snapshot_json=row.get("weather_snapshot_json"),
    )
    return await serialize_calendar_entry(connection, row)


async def delete_calendar_entry_for_day(connection: AsyncConnection, user_id: str, target_date: date) -> None:
    existing = await _calendar_row_by_date(connection, user_id, target_date)
    if existing is None:
        return

    await _delete_entry_wear_logs(
        connection,
        user_id,
        target_date=target_date,
        calendar_entry_id=existing["id"],
    )
    await connection.execute(
        delete(outfit_calendar_entries).where(
            outfit_calendar_entries.c.user_id == user_id,
            outfit_calendar_entries.c.date == target_date,
        )
    )


async def _ensure_outfit_wear_log(
    connection: AsyncConnection,
    user_id: str,
    outfit_id: str,
    worn_date: date,
    source: str,
    *,
    calendar_entry_id: str | None = None,
    weather_snapshot_json: dict | None = None,
) -> None:
    existing = (
        await connection.execute(
            select(outfit_wear_logs.c.id).where(
                outfit_wear_logs.c.user_id == user_id,
                outfit_wear_logs.c.outfit_id == outfit_id,
                outfit_wear_logs.c.worn_date == worn_date,
                outfit_wear_logs.c.source == source,
                outfit_wear_logs.c.calendar_entry_id == calendar_entry_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return

    await connection.execute(
        insert(outfit_wear_logs).values(
            id=new_id("outfit_wear_log"),
            user_id=user_id,
            outfit_id=outfit_id,
            worn_date=worn_date,
            calendar_entry_id=calendar_entry_id,
            source=source,
            weather_snapshot_json=weather_snapshot_json,
            created_at=datetime.now(timezone.utc),
        )
    )


async def _ensure_item_wear_logs(
    connection: AsyncConnection,
    user_id: str,
    item_ids: list[str],
    worn_date: date,
    source: str,
    *,
    outfit_id: str | None = None,
    calendar_entry_id: str | None = None,
) -> None:
    if not item_ids:
        return

    rows = (
        await connection.execute(
            select(item_wear_logs.c.item_id).where(
                item_wear_logs.c.user_id == user_id,
                item_wear_logs.c.item_id.in_(item_ids),
                item_wear_logs.c.worn_date == worn_date,
                item_wear_logs.c.source == source,
                item_wear_logs.c.outfit_id == outfit_id,
                item_wear_logs.c.calendar_entry_id == calendar_entry_id,
            )
        )
    ).scalars().all()
    existing_ids = set(rows)
    pending_ids = [item_id for item_id in item_ids if item_id not in existing_ids]

    if pending_ids:
        await connection.execute(
            insert(item_wear_logs),
            [
                {
                    "id": new_id("item_wear_log"),
                    "user_id": user_id,
                    "item_id": item_id,
                    "outfit_id": outfit_id,
                    "calendar_entry_id": calendar_entry_id,
                    "worn_date": worn_date,
                    "source": source,
                    "created_at": datetime.now(timezone.utc),
                }
                for item_id in pending_ids
            ],
        )


async def log_manual_outfit_wear(
    connection: AsyncConnection,
    user_id: str,
    outfit_id: str,
    worn_date: date,
    source: str,
    weather_snapshot_json: dict | None = None,
) -> CalendarEntryResponse:
    outfit_row = await _owned_outfit_row(connection, user_id, outfit_id)
    existing = await _calendar_row_by_date(connection, user_id, worn_date)
    if existing is not None:
        await _delete_entry_wear_logs(
            connection,
            user_id,
            target_date=worn_date,
            calendar_entry_id=existing["id"],
        )
    row = await _upsert_calendar_row(
        connection,
        user_id,
        worn_date,
        outfit_id=outfit_id,
        weather_snapshot_json=weather_snapshot_json,
    )
    item_ids = await _outfit_item_ids(connection, outfit_row["id"])
    await _ensure_outfit_wear_log(
        connection,
        user_id,
        outfit_id,
        worn_date,
        source,
        calendar_entry_id=row["id"],
        weather_snapshot_json=weather_snapshot_json,
    )
    await _ensure_item_wear_logs(
        connection,
        user_id,
        item_ids,
        worn_date,
        source,
        outfit_id=outfit_id,
        calendar_entry_id=row["id"],
    )
    if item_ids:
        await connection.execute(
            update(wardrobe_items)
            .where(wardrobe_items.c.id.in_(item_ids))
            .values(last_worn_at=_worn_at(worn_date))
        )
    return await serialize_calendar_entry(connection, row)


async def log_manual_item_wear(
    connection: AsyncConnection,
    user_id: str,
    item_ids: list[str],
    worn_date: date,
    source: str,
) -> CalendarEntryResponse:
    items = await _owned_item_rows(connection, user_id, item_ids)
    existing = await _calendar_row_by_date(connection, user_id, worn_date)
    if existing is not None:
        await _delete_entry_wear_logs(
            connection,
            user_id,
            target_date=worn_date,
            calendar_entry_id=existing["id"],
        )
    row = await _upsert_calendar_row(
        connection,
        user_id,
        worn_date,
        outfit_id=None,
        weather_snapshot_json=None,
    )
    unique_ids = [item["id"] for item in items]
    await _ensure_item_wear_logs(
        connection,
        user_id,
        unique_ids,
        worn_date,
        source,
        outfit_id=None,
        calendar_entry_id=row["id"],
    )
    await connection.execute(
        update(wardrobe_items)
        .where(wardrobe_items.c.id.in_(unique_ids))
        .values(last_worn_at=_worn_at(worn_date))
    )
    return await serialize_calendar_entry(connection, row)


async def wear_history(
    connection: AsyncConnection,
    user_id: str,
    date_from: date,
    date_to: date,
) -> WearHistoryResponse:
    if date_from > date_to:
        raise ValueError("date_from must be less than or equal to date_to")

    outfit_rows = (
        await connection.execute(
            select(outfit_wear_logs)
            .where(
                outfit_wear_logs.c.user_id == user_id,
                outfit_wear_logs.c.worn_date >= date_from,
                outfit_wear_logs.c.worn_date <= date_to,
            )
            .order_by(outfit_wear_logs.c.worn_date.desc(), outfit_wear_logs.c.created_at.desc())
        )
    ).mappings().all()
    item_rows = (
        await connection.execute(
            select(item_wear_logs)
            .where(
                item_wear_logs.c.user_id == user_id,
                item_wear_logs.c.worn_date >= date_from,
                item_wear_logs.c.worn_date <= date_to,
            )
            .order_by(item_wear_logs.c.worn_date.desc(), item_wear_logs.c.created_at.desc())
        )
    ).mappings().all()

    preview_cache: dict[str, OutfitPreview | None] = {}

    async def preview_for(outfit_id: str | None) -> OutfitPreview | None:
        if not outfit_id:
            return None
        if outfit_id not in preview_cache:
            outfit_row = await _owned_outfit_row(connection, user_id, outfit_id)
            preview_cache[outfit_id] = await serialize_outfit_preview(connection, outfit_row)
        return preview_cache[outfit_id]

    return WearHistoryResponse(
        outfit_logs=[
            OutfitWearLogResponse(
                id=row["id"],
                outfit_id=row["outfit_id"],
                worn_date=row["worn_date"],
                calendar_entry_id=row.get("calendar_entry_id"),
                source=row["source"],
                weather_snapshot_json=row.get("weather_snapshot_json"),
                outfit=await preview_for(row["outfit_id"]),
                created_at=_iso_datetime(row.get("created_at")),
            )
            for row in outfit_rows
        ],
        item_logs=[
            ItemWearLogResponse(
                id=row["id"],
                item_id=row["item_id"],
                outfit_id=row.get("outfit_id"),
                calendar_entry_id=row.get("calendar_entry_id"),
                worn_date=row["worn_date"],
                source=row["source"],
                created_at=_iso_datetime(row.get("created_at")),
            )
            for row in item_rows
        ],
    )
