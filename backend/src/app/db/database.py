from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine

from app.core.config import get_settings


settings = get_settings()
engine: AsyncEngine = create_async_engine(settings.database_url, pool_pre_ping=True)


async def get_connection() -> AsyncIterator[AsyncConnection]:
    async with engine.connect() as connection:
        try:
            yield connection
            await connection.commit()
        except Exception:
            await connection.rollback()
            raise
