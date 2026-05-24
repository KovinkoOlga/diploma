from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field


CalendarEntryStatus = Literal["planned", "worn", "skipped"]
WearLogSource = Literal["calendar_confirmation", "manual_outfit", "weekly_checkin"]


class OutfitPreview(BaseModel):
    id: str
    title: str
    item_ids: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    season: list[str] = Field(default_factory=list)
    cover_image_url: str | None = None
    cover_transparent_image_url: str | None = None


class WardrobeItemPreview(BaseModel):
    id: str
    title: str
    category_id: str
    subcategory: str = ""
    image_url: str | None = None


class CalendarEntryResponse(BaseModel):
    id: str
    date: date
    status: CalendarEntryStatus
    weather_snapshot_json: dict[str, Any] | None = None
    outfit: OutfitPreview | None = None
    items: list[WardrobeItemPreview] = Field(default_factory=list)
    has_content: bool = False


class CalendarDayUpsertPayload(BaseModel):
    date: date
    outfit_id: str
    weather_snapshot_json: dict[str, Any] | None = None


class ManualOutfitWearPayload(BaseModel):
    outfit_id: str
    worn_date: date
    source: Literal["manual_outfit", "weekly_checkin"] = "manual_outfit"
    weather_snapshot_json: dict[str, Any] | None = None


class ManualItemWearPayload(BaseModel):
    item_ids: list[str] = Field(default_factory=list, min_length=1)
    worn_date: date
    source: Literal["manual_outfit", "weekly_checkin"] = "manual_outfit"


class OutfitWearLogResponse(BaseModel):
    id: str
    outfit_id: str
    worn_date: date
    calendar_entry_id: str | None = None
    source: WearLogSource
    weather_snapshot_json: dict[str, Any] | None = None
    outfit: OutfitPreview | None = None
    created_at: str


class ItemWearLogResponse(BaseModel):
    id: str
    item_id: str
    outfit_id: str | None = None
    calendar_entry_id: str | None = None
    worn_date: date
    source: WearLogSource
    created_at: str


class WearHistoryResponse(BaseModel):
    outfit_logs: list[OutfitWearLogResponse] = Field(default_factory=list)
    item_logs: list[ItemWearLogResponse] = Field(default_factory=list)
