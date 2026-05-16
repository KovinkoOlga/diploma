import asyncio
from collections.abc import Awaitable
from typing import TypeVar

from celery import Celery
from celery.signals import worker_process_init, worker_process_shutdown

from app.core.config import get_settings
from app.db.database import engine


settings = get_settings()
_T = TypeVar("_T")
_worker_loop: asyncio.AbstractEventLoop | None = None

celery_app = Celery(
    "wardrobe",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.wardrobe_tasks"],
)

celery_app.conf.update(
    task_always_eager=settings.celery_task_always_eager,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)


def run_async_in_worker(awaitable: Awaitable[_T]) -> _T:
    global _worker_loop

    if _worker_loop is None or _worker_loop.is_closed():
        _worker_loop = asyncio.new_event_loop()

    asyncio.set_event_loop(_worker_loop)
    return _worker_loop.run_until_complete(awaitable)


@worker_process_init.connect
def setup_worker_event_loop(**_: object) -> None:
    global _worker_loop

    # Drop any pool state inherited from the Celery parent process after fork.
    engine.sync_engine.dispose(close=False)

    if _worker_loop is None or _worker_loop.is_closed():
        _worker_loop = asyncio.new_event_loop()

    asyncio.set_event_loop(_worker_loop)


@worker_process_shutdown.connect
def teardown_worker_event_loop(**_: object) -> None:
    global _worker_loop

    if _worker_loop is None or _worker_loop.is_closed():
        _worker_loop = None
        asyncio.set_event_loop(None)
        return

    try:
        _worker_loop.run_until_complete(engine.dispose())
    finally:
        _worker_loop.close()
        _worker_loop = None
        asyncio.set_event_loop(None)
