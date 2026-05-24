from datetime import date

import pytest
from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.metadata import (
    categories,
    item_statuses,
    item_wear_logs,
    outfits,
    outfit_calendar_entries,
    outfit_items,
    outfit_wear_logs,
    seasons,
    styles,
    subcategories,
    users,
    wardrobe_catalogs,
    wardrobe_items,
    metadata,
)
from app.modules.calendar.service import (
    delete_calendar_entry_for_day,
    log_manual_item_wear,
    upsert_calendar_entry,
)


@pytest.fixture()
async def connection():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(metadata.create_all)
        await conn.execute(
            insert(users),
            [
                {"id": "user_1", "email": "user1@example.com", "password_hash": "hash", "display_name": "User 1"},
                {"id": "user_2", "email": "user2@example.com", "password_hash": "hash", "display_name": "User 2"},
            ],
        )
        await conn.execute(
            insert(wardrobe_catalogs),
            [
                {"id": "catalog_1", "user_id": "user_1", "name": "Основное", "sort_order": 10, "is_default": True},
                {"id": "catalog_2", "user_id": "user_2", "name": "Основное", "sort_order": 10, "is_default": True},
            ],
        )
        await conn.execute(insert(categories).values(id="tops", name="Верх", icon_key="tops", sort_order=10))
        await conn.execute(
            insert(subcategories).values(
                id="subcategory_top",
                category_id="tops",
                user_id=None,
                name="Топ",
                normalized_name="топ",
                is_system=True,
            )
        )
        await conn.execute(insert(item_statuses).values(id="status_active", code="active", name="Активна", sort_order=10))
        await conn.execute(insert(styles).values(id="style_casual", user_id=None, name="casual", normalized_name="casual", is_system=True))
        await conn.execute(insert(seasons).values(id="season_summer", name="лето", sort_order=10))
        await conn.execute(
            insert(wardrobe_items),
            [
                {
                    "id": "item_1",
                    "user_id": "user_1",
                    "catalog_id": "catalog_1",
                    "category_id": "tops",
                    "subcategory_id": "subcategory_top",
                    "status_id": "status_active",
                    "name": "Футболка",
                },
                {
                    "id": "item_2",
                    "user_id": "user_1",
                    "catalog_id": "catalog_1",
                    "category_id": "tops",
                    "subcategory_id": "subcategory_top",
                    "status_id": "status_active",
                    "name": "Рубашка",
                },
                {
                    "id": "item_3",
                    "user_id": "user_2",
                    "catalog_id": "catalog_2",
                    "category_id": "tops",
                    "subcategory_id": "subcategory_top",
                    "status_id": "status_active",
                    "name": "Чужая вещь",
                },
            ],
        )
        await conn.execute(
            insert(outfits),
            [
                {"id": "outfit_1", "user_id": "user_1", "name": "Офис", "style_id": "style_casual"},
                {"id": "outfit_2", "user_id": "user_2", "name": "Чужой образ", "style_id": "style_casual"},
            ],
        )
        await conn.execute(
            insert(outfit_items),
            [
                {"id": "outfit_item_1", "outfit_id": "outfit_1", "item_id": "item_1", "role_code": "item"},
                {"id": "outfit_item_2", "outfit_id": "outfit_1", "item_id": "item_2", "role_code": "item"},
            ],
        )
        yield conn
    await engine.dispose()


@pytest.mark.asyncio
async def test_assign_calendar_entry_creates_logs_without_duplicates(connection):
    worn_day = date(2026, 5, 24)
    await upsert_calendar_entry(connection, "user_1", worn_day, "outfit_1")
    await upsert_calendar_entry(connection, "user_1", worn_day, "outfit_1")

    calendar_row = (
        await connection.execute(select(outfit_calendar_entries.c.status).where(outfit_calendar_entries.c.user_id == "user_1"))
    ).scalar_one()
    outfit_log_count = (
        await connection.execute(select(outfit_wear_logs.c.id).where(outfit_wear_logs.c.user_id == "user_1"))
    ).all()
    item_log_count = (
        await connection.execute(select(item_wear_logs.c.id).where(item_wear_logs.c.user_id == "user_1"))
    ).all()
    worn_at_values = (
        await connection.execute(
            select(wardrobe_items.c.last_worn_at).where(wardrobe_items.c.id.in_(["item_1", "item_2"])).order_by(wardrobe_items.c.id)
        )
    ).scalars().all()

    assert calendar_row == "planned"
    assert len(outfit_log_count) == 1
    assert len(item_log_count) == 2
    assert all(value is not None for value in worn_at_values)


@pytest.mark.asyncio
async def test_replace_calendar_outfit_rewrites_calendar_logs(connection):
    replacement_item = {
        "id": "item_4",
        "user_id": "user_1",
        "catalog_id": "catalog_1",
        "category_id": "tops",
        "subcategory_id": "subcategory_top",
        "status_id": "status_active",
        "name": "Пиджак",
    }
    replacement_outfit = {"id": "outfit_3", "user_id": "user_1", "name": "Вечер", "style_id": "style_casual"}
    replacement_link = {"id": "outfit_item_3", "outfit_id": "outfit_3", "item_id": "item_4", "role_code": "item"}
    await connection.execute(insert(wardrobe_items).values(replacement_item))
    await connection.execute(insert(outfits).values(replacement_outfit))
    await connection.execute(insert(outfit_items).values(replacement_link))

    worn_day = date(2026, 5, 27)
    await upsert_calendar_entry(connection, "user_1", worn_day, "outfit_1")
    await upsert_calendar_entry(connection, "user_1", worn_day, "outfit_3")

    outfit_logs = (
        await connection.execute(select(outfit_wear_logs.c.outfit_id).where(outfit_wear_logs.c.user_id == "user_1"))
    ).scalars().all()
    item_logs = (
        await connection.execute(
            select(item_wear_logs.c.item_id).where(item_wear_logs.c.user_id == "user_1").order_by(item_wear_logs.c.item_id)
        )
    ).scalars().all()

    assert outfit_logs == ["outfit_3"]
    assert item_logs == ["item_4"]


@pytest.mark.asyncio
async def test_delete_calendar_entry_removes_calendar_logs(connection):
    worn_day = date(2026, 5, 28)
    await upsert_calendar_entry(connection, "user_1", worn_day, "outfit_1")

    await delete_calendar_entry_for_day(connection, "user_1", worn_day)

    calendar_row = (
        await connection.execute(
            select(outfit_calendar_entries.c.id).where(
                outfit_calendar_entries.c.user_id == "user_1",
                outfit_calendar_entries.c.date == worn_day,
            )
        )
    ).scalar_one_or_none()
    outfit_log_count = (
        await connection.execute(select(func.count()).select_from(outfit_wear_logs).where(outfit_wear_logs.c.user_id == "user_1"))
    ).scalar_one()
    item_log_count = (
        await connection.execute(select(func.count()).select_from(item_wear_logs).where(item_wear_logs.c.user_id == "user_1"))
    ).scalar_one()

    assert calendar_row is None
    assert outfit_log_count == 0
    assert item_log_count == 0


@pytest.mark.asyncio
async def test_manual_item_wear_updates_calendar_without_outfit(connection):
    worn_day = date(2026, 5, 25)
    entry = await log_manual_item_wear(connection, "user_1", ["item_1", "item_2"], worn_day, "manual_outfit")

    calendar_row = (
        await connection.execute(
            select(outfit_calendar_entries.c.outfit_id, outfit_calendar_entries.c.status).where(
                outfit_calendar_entries.c.user_id == "user_1",
                outfit_calendar_entries.c.date == worn_day,
            )
        )
    ).first()

    assert entry.status == "planned"
    assert entry.outfit is None
    assert [item.id for item in entry.items] == ["item_1", "item_2"]
    assert entry.has_content is True
    assert calendar_row.outfit_id is None
    assert calendar_row.status == "planned"


@pytest.mark.asyncio
async def test_assign_calendar_entry_replaces_manual_item_logs(connection):
    worn_day = date(2026, 5, 29)
    await log_manual_item_wear(connection, "user_1", ["item_1", "item_2"], worn_day, "weekly_checkin")

    await upsert_calendar_entry(connection, "user_1", worn_day, "outfit_1")

    outfit_sources = (
        await connection.execute(select(outfit_wear_logs.c.source).where(outfit_wear_logs.c.user_id == "user_1"))
    ).scalars().all()
    item_sources = (
        await connection.execute(
            select(item_wear_logs.c.source).where(item_wear_logs.c.user_id == "user_1").order_by(item_wear_logs.c.item_id)
        )
    ).scalars().all()

    assert outfit_sources == ["calendar_confirmation"]
    assert item_sources == ["calendar_confirmation", "calendar_confirmation"]


@pytest.mark.asyncio
async def test_cannot_plan_foreign_outfit(connection):
    with pytest.raises(LookupError):
        await upsert_calendar_entry(connection, "user_1", date(2026, 5, 26), "outfit_2")
