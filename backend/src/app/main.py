from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.database import engine
from app.modules.admin.routes import setup_admin
from app.modules.auth.routes import router as auth_router
from app.modules.content.routes import router as content_router
from app.modules.outfits.routes import router as outfits_router
from app.modules.users.routes import router as users_router
from app.modules.wardrobe.internal_routes import router as internal_wardrobe_router
from app.modules.wardrobe.routes import router as wardrobe_router
from app.modules.wardrobe.seed import ensure_demo_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    async with engine.begin() as connection:
        await ensure_demo_user(connection, settings.default_user_email, hash_password(settings.default_user_password))
    yield
    await engine.dispose()


settings = get_settings()
app = FastAPI(title="Digital Wardrobe API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(internal_wardrobe_router)
app.include_router(wardrobe_router)
app.include_router(outfits_router)
app.include_router(content_router)
setup_admin(app)
