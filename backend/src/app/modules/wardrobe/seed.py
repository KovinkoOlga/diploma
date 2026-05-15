from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncConnection

from app.db.metadata import users, wardrobe_catalogs


DEFAULT_CATALOGS = [
    {"id": "main", "title": "Основное", "description": "База на каждый день", "sort_order": 10, "is_default": True},
    {"id": "home", "title": "Домашнее", "description": "Комфортные вещи для дома", "sort_order": 20, "is_default": True},
    {"id": "sport", "title": "Тренировочное", "description": "Форма и вещи для активности", "sort_order": 30, "is_default": True},
]


async def ensure_default_catalogs(connection: AsyncConnection, user_id: str) -> None:
    existing = (await connection.execute(select(wardrobe_catalogs.c.id).where(wardrobe_catalogs.c.user_id == user_id))).first()
    if existing:
        return
    await connection.execute(
        insert(wardrobe_catalogs),
        [
            {
                "id": f"{catalog['id']}_{user_id}",
                "user_id": user_id,
                "name": catalog["title"],
                "sort_order": catalog["sort_order"],
                "is_default": catalog["is_default"],
            }
            for catalog in DEFAULT_CATALOGS
        ],
    )


async def ensure_demo_user(connection: AsyncConnection, email: str, password_hash: str) -> None:
    row = (await connection.execute(select(users.c.id).where(users.c.email == email))).first()
    if row:
        await ensure_default_catalogs(connection, row[0])
        return
    user_id = "user_demo"
    await connection.execute(
        insert(users).values(
            id=user_id,
            email=email,
            password_hash=password_hash,
            display_name="Demo",
        )
    )
    await ensure_default_catalogs(connection, user_id)

