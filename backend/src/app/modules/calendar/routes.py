from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncConnection

from app.db.database import get_connection
from app.modules.auth.dependencies import get_current_user
from app.modules.calendar import service
from app.modules.calendar.schemas import (
    CalendarDayUpsertPayload,
    CalendarEntryResponse,
    ManualItemWearPayload,
    ManualOutfitWearPayload,
    WearHistoryResponse,
)


router = APIRouter(tags=["calendar"])


def _user_id(user: dict) -> str:
    return user["id"]


@router.get("/outfit-calendar", response_model=list[CalendarEntryResponse])
async def list_outfit_calendar_entries(
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> list[CalendarEntryResponse]:
    try:
        return await service.list_calendar_entries(connection, _user_id(current_user), date_from, date_to)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/outfit-calendar/day", response_model=CalendarEntryResponse | None)
async def get_outfit_calendar_day(
    date: date = Query(...),
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> CalendarEntryResponse | None:
    return await service.get_calendar_entry_for_day(connection, _user_id(current_user), date)


@router.put("/outfit-calendar/day", response_model=CalendarEntryResponse)
async def put_outfit_calendar_day(
    payload: CalendarDayUpsertPayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> CalendarEntryResponse:
    try:
        return await service.upsert_calendar_entry(
            connection,
            _user_id(current_user),
            payload.date,
            payload.outfit_id,
            payload.weather_snapshot_json,
        )
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outfit not found")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/outfit-calendar/day", status_code=status.HTTP_204_NO_CONTENT)
async def delete_outfit_calendar_day(
    date: date = Query(...),
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> None:
    await service.delete_calendar_entry_for_day(connection, _user_id(current_user), date)


@router.post("/wear-logs/outfit", response_model=CalendarEntryResponse)
async def create_manual_outfit_wear_log(
    payload: ManualOutfitWearPayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> CalendarEntryResponse:
    try:
        return await service.log_manual_outfit_wear(
            connection,
            _user_id(current_user),
            payload.outfit_id,
            payload.worn_date,
            payload.source,
            payload.weather_snapshot_json,
        )
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outfit not found")


@router.post("/wear-logs/items", response_model=CalendarEntryResponse)
async def create_manual_item_wear_log(
    payload: ManualItemWearPayload,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> CalendarEntryResponse:
    try:
        return await service.log_manual_item_wear(
            connection,
            _user_id(current_user),
            payload.item_ids,
            payload.worn_date,
            payload.source,
        )
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/wear-logs", response_model=WearHistoryResponse)
async def get_wear_logs(
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> WearHistoryResponse:
    try:
        return await service.wear_history(connection, _user_id(current_user), date_from, date_to)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
