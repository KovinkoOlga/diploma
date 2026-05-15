from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_expires_at,
    verify_password,
)
from app.db.database import get_connection
from app.db.metadata import refresh_sessions, users
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.schemas import (
    AuthRequest,
    ChangePasswordRequest,
    LogoutRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from app.modules.files.service import get_file_url
from app.modules.wardrobe.seed import ensure_default_catalogs


router = APIRouter(prefix="/auth", tags=["auth"])


async def user_response(connection: AsyncConnection, user: dict) -> UserResponse:
    avatar_url = await get_file_url(connection, user.get("avatar_file_id"), "thumbnail")
    return UserResponse(
        id=user["id"],
        email=user["email"],
        displayName=user.get("display_name") or "",
        avatarFileId=user.get("avatar_file_id"),
        avatarUrl=avatar_url,
    )


async def issue_token_pair(
    connection: AsyncConnection,
    user: dict,
    user_agent: str = "",
    device_name: str = "",
) -> TokenResponse:
    refresh_token = create_refresh_token()
    session_id = f"session_{uuid4().hex}"
    await connection.execute(
        insert(refresh_sessions).values(
            id=session_id,
            user_id=user["id"],
            refresh_token_hash=hash_refresh_token(refresh_token),
            expires_at=refresh_expires_at(),
            user_agent=user_agent[:255],
            device_name=device_name[:120],
        )
    )
    return TokenResponse(
        accessToken=create_access_token(user["id"]),
        refreshToken=refresh_token,
        user=await user_response(connection, user),
    )


async def _find_refresh_session(connection: AsyncConnection, refresh_token: str) -> dict:
    row = (
        await connection.execute(
            select(
                refresh_sessions.c.id.label("session_id"),
                refresh_sessions.c.user_id,
                refresh_sessions.c.expires_at,
                refresh_sessions.c.revoked_at,
                users.c.email,
                users.c.display_name,
                users.c.avatar_file_id,
            )
            .select_from(refresh_sessions.join(users, refresh_sessions.c.user_id == users.c.id))
            .where(refresh_sessions.c.refresh_token_hash == hash_refresh_token(refresh_token))
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    session = dict(row)
    now = datetime.now(timezone.utc)
    if session["revoked_at"] is not None or session["expires_at"] <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired or revoked")
    return session


@router.post("/register", response_model=TokenResponse)
async def register(
    payload: AuthRequest,
    connection: AsyncConnection = Depends(get_connection),
    user_agent: str = Header(default="", alias="User-Agent"),
    x_device_name: str = Header(default="", alias="X-Device-Name"),
) -> TokenResponse:
    user = {
        "id": f"user_{uuid4().hex}",
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "display_name": payload.email.split("@")[0],
    }
    try:
        await connection.execute(insert(users).values(user))
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    await ensure_default_catalogs(connection, user["id"])
    return await issue_token_pair(connection, user, user_agent, x_device_name)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: AuthRequest,
    connection: AsyncConnection = Depends(get_connection),
    user_agent: str = Header(default="", alias="User-Agent"),
    x_device_name: str = Header(default="", alias="X-Device-Name"),
) -> TokenResponse:
    row = (await connection.execute(select(users).where(users.c.email == payload.email.lower()))).mappings().first()
    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return await issue_token_pair(connection, dict(row), user_agent, x_device_name)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    connection: AsyncConnection = Depends(get_connection),
    user_agent: str = Header(default="", alias="User-Agent"),
    x_device_name: str = Header(default="", alias="X-Device-Name"),
) -> TokenResponse:
    session = await _find_refresh_session(connection, payload.refreshToken)
    user = {
        "id": session["user_id"],
        "email": session["email"],
        "display_name": session["display_name"],
        "avatar_file_id": session["avatar_file_id"],
    }
    token_pair = await issue_token_pair(connection, user, user_agent, x_device_name)
    new_session = (
        await connection.execute(
            select(refresh_sessions.c.id).where(refresh_sessions.c.refresh_token_hash == hash_refresh_token(token_pair.refreshToken))
        )
    ).scalar_one()
    await connection.execute(
        update(refresh_sessions)
        .where(refresh_sessions.c.id == session["session_id"])
        .values(revoked_at=datetime.now(timezone.utc), replaced_by_session_id=new_session)
    )
    return token_pair


@router.post("/logout")
async def logout(payload: LogoutRequest, connection: AsyncConnection = Depends(get_connection)) -> dict[str, bool]:
    if payload.refreshToken:
        await connection.execute(
            update(refresh_sessions)
            .where(refresh_sessions.c.refresh_token_hash == hash_refresh_token(payload.refreshToken))
            .values(revoked_at=datetime.now(timezone.utc))
        )
    return {"ok": True}


@router.post("/logout-all")
async def logout_all(
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> dict[str, bool]:
    await connection.execute(
        update(refresh_sessions)
        .where(refresh_sessions.c.user_id == current_user["id"], refresh_sessions.c.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> UserResponse:
    return await user_response(connection, current_user)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> dict[str, bool]:
    if not verify_password(payload.currentPassword, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid current password")
    await connection.execute(
        update(users).where(users.c.id == current_user["id"]).values(password_hash=hash_password(payload.newPassword))
    )
    await connection.execute(
        update(refresh_sessions)
        .where(refresh_sessions.c.user_id == current_user["id"], refresh_sessions.c.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    return {"ok": True}
