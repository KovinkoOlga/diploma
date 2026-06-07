from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncConnection

from app.db.database import get_connection
from app.db.metadata import users
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.routes import user_response
from app.modules.auth.schemas import UserResponse
from app.modules.files.service import create_image_file
from app.modules.users.schemas import ProfilePatch


router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    payload: ProfilePatch,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> UserResponse:
    values = {}
    if payload.displayName is not None:
        values["display_name"] = payload.displayName.strip()
    if values:
        await connection.execute(update(users).where(users.c.id == current_user["id"]).values(**values))
    row = (await connection.execute(select(users).where(users.c.id == current_user["id"]))).mappings().one()
    return await user_response(connection, dict(row))


@router.post("/me/avatar", response_model=UserResponse)
async def update_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> UserResponse:
    content = await file.read()
    file_id = await create_image_file(
        connection,
        current_user["id"],
        content,
        file.filename or "avatar",
        file.content_type or "application/octet-stream",
    )
    await connection.execute(update(users).where(users.c.id == current_user["id"]).values(avatar_file_id=file_id))
    row = (await connection.execute(select(users).where(users.c.id == current_user["id"]))).mappings().one()
    return await user_response(connection, dict(row))
