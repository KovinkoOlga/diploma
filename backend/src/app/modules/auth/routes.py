import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token, hash_refresh_token, refresh_expires_at
from app.db.database import get_connection
from app.db.metadata import refresh_sessions, users
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.email_codes import (
    CHANGE_PRIMARY_EMAIL_PURPOSE,
    LOGIN_CODE_PURPOSE,
    REGISTER_CODE_PURPOSE,
    VERIFY_BACKUP_EMAIL_PURPOSE,
    EmailCodeCooldownError,
    EmailCodeVerificationError,
    IssuedEmailCode,
    mark_code_unusable,
    normalize_email,
    issue_email_code,
    verify_email_code,
)
from app.modules.auth.email_sender import log_dev_email_code
from app.modules.auth.schemas import (
    BackupEmailRequest,
    CodeRequestResponse,
    EmailCodeVerifyRequest,
    EmailRequest,
    LogoutRequest,
    PrimaryEmailChangeRequest,
    PrimaryEmailVerifyRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
    VerifyCodeRequest,
)
from app.modules.files.service import get_file_url
from app.modules.wardrobe.seed import ensure_default_catalogs
from app.tasks.email_tasks import send_email_code_task


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _datetime_to_iso(value: datetime | str | None) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if value is None:
        return ""
    return str(value)


def _datetime_to_iso_or_none(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _http_conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _http_bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


async def user_response(connection: AsyncConnection, user: dict) -> UserResponse:
    avatar_url = await get_file_url(connection, user.get("avatar_file_id"), "thumbnail")
    return UserResponse(
        id=user["id"],
        email=user["email"],
        emailVerified=user.get("email_verified_at") is not None,
        backupEmail=user.get("backup_email"),
        backupEmailVerified=user.get("backup_email_verified_at") is not None,
        displayName=user.get("display_name") or "",
        avatarFileId=user.get("avatar_file_id"),
        avatarUrl=avatar_url,
        createdAt=_datetime_to_iso(user.get("created_at")),
    )


async def _load_user_by_id(connection: AsyncConnection, user_id: str) -> dict:
    row = (await connection.execute(select(users).where(users.c.id == user_id))).mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return dict(row)


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
                users.c.email_verified_at,
                users.c.backup_email,
                users.c.backup_email_verified_at,
                users.c.display_name,
                users.c.avatar_file_id,
                users.c.created_at,
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


async def _email_exists_as_primary(
    connection: AsyncConnection,
    email: str,
    *,
    exclude_user_id: str | None = None,
) -> bool:
    stmt = select(users.c.id).where(users.c.email == email)
    if exclude_user_id:
        stmt = stmt.where(users.c.id != exclude_user_id)
    return (await connection.execute(stmt)).first() is not None


async def _email_exists_as_confirmed_backup(
    connection: AsyncConnection,
    email: str,
    *,
    exclude_user_id: str | None = None,
) -> bool:
    stmt = select(users.c.id).where(users.c.backup_email == email, users.c.backup_email_verified_at.is_not(None))
    if exclude_user_id:
        stmt = stmt.where(users.c.id != exclude_user_id)
    return (await connection.execute(stmt)).first() is not None


async def _resolve_login_user(connection: AsyncConnection, email: str) -> dict | None:
    primary = (await connection.execute(select(users).where(users.c.email == email))).mappings().first()
    if primary is not None:
        return dict(primary)
    backup = (
        await connection.execute(
            select(users).where(users.c.backup_email == email, users.c.backup_email_verified_at.is_not(None))
        )
    ).mappings().first()
    return dict(backup) if backup is not None else None


def _code_request_response(issued: IssuedEmailCode) -> CodeRequestResponse:
    return CodeRequestResponse(
        ok=True,
        cooldownSeconds=issued.cooldown_seconds,
        nextResendAt=_datetime_to_iso_or_none(issued.next_resend_at),
        devCode=issued.dev_code,
    )


def _handle_code_errors(error: Exception) -> None:
    if isinstance(error, EmailCodeCooldownError):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Resend available later")
    if isinstance(error, EmailCodeVerificationError):
        message = str(error)
        status_code = status.HTTP_400_BAD_REQUEST
        if message == "Too many attempts":
            status_code = status.HTTP_429_TOO_MANY_REQUESTS
        raise HTTPException(status_code=status_code, detail=message)
    raise error


async def _queue_email_delivery(
    connection: AsyncConnection,
    issued: IssuedEmailCode,
) -> CodeRequestResponse:
    settings = get_settings()
    try:
        send_email_code_task.delay(issued.email, issued.plain_code, issued.purpose)
    except Exception:
        logger.exception("Failed to enqueue email code for purpose=%s email=%s", issued.purpose, issued.email)
        if settings.is_local_or_dev:
            log_dev_email_code(issued.email, issued.plain_code, issued.purpose, source="api-enqueue-failed")
            return _code_request_response(issued)
        await mark_code_unusable(connection, issued.code_id, reason="delivery_failed", clear_cooldown=True)
        await connection.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send code right now. Please try again later.",
        )
    return _code_request_response(issued)


@router.post("/register/request-code", response_model=CodeRequestResponse)
async def request_register_code(
    payload: EmailRequest,
    connection: AsyncConnection = Depends(get_connection),
) -> CodeRequestResponse:
    email = normalize_email(payload.email)
    if await _email_exists_as_primary(connection, email) or await _email_exists_as_confirmed_backup(connection, email):
        raise _http_conflict("Email already in use")
    try:
        issued = await issue_email_code(connection, email=email, purpose=REGISTER_CODE_PURPOSE, user_id=None)
    except Exception as error:
        _handle_code_errors(error)
        raise
    return await _queue_email_delivery(connection, issued)


@router.post("/register/verify-code", response_model=TokenResponse)
async def verify_register_code(
    payload: EmailCodeVerifyRequest,
    connection: AsyncConnection = Depends(get_connection),
    user_agent: str = Header(default="", alias="User-Agent"),
    x_device_name: str = Header(default="", alias="X-Device-Name"),
) -> TokenResponse:
    email = normalize_email(payload.email)
    if await _email_exists_as_primary(connection, email) or await _email_exists_as_confirmed_backup(connection, email):
        raise _http_conflict("Email already in use")
    try:
        await verify_email_code(connection, email=email, purpose=REGISTER_CODE_PURPOSE, code=payload.code, user_id=None)
    except Exception as error:
        _handle_code_errors(error)
        raise

    user_id = f"user_{uuid4().hex}"
    user = {
        "id": user_id,
        "email": email,
        "email_verified_at": datetime.now(timezone.utc),
        "display_name": email.split("@", 1)[0],
    }
    try:
        await connection.execute(insert(users).values(**user))
    except IntegrityError:
        raise _http_conflict("Email already in use")
    await ensure_default_catalogs(connection, user_id)
    row = await _load_user_by_id(connection, user_id)
    return await issue_token_pair(connection, row, user_agent, x_device_name)


@router.post("/login/request-code", response_model=CodeRequestResponse)
async def request_login_code(
    payload: EmailRequest,
    connection: AsyncConnection = Depends(get_connection),
) -> CodeRequestResponse:
    email = normalize_email(payload.email)
    user = await _resolve_login_user(connection, email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email is not registered or not verified")
    try:
        issued = await issue_email_code(connection, email=email, purpose=LOGIN_CODE_PURPOSE, user_id=user["id"])
    except Exception as error:
        _handle_code_errors(error)
        raise
    return await _queue_email_delivery(connection, issued)


@router.post("/login/verify-code", response_model=TokenResponse)
async def verify_login_code(
    payload: EmailCodeVerifyRequest,
    connection: AsyncConnection = Depends(get_connection),
    user_agent: str = Header(default="", alias="User-Agent"),
    x_device_name: str = Header(default="", alias="X-Device-Name"),
) -> TokenResponse:
    email = normalize_email(payload.email)
    user = await _resolve_login_user(connection, email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email is not registered or not verified")
    try:
        await verify_email_code(connection, email=email, purpose=LOGIN_CODE_PURPOSE, code=payload.code, user_id=user["id"])
    except Exception as error:
        _handle_code_errors(error)
        raise
    current_user = await _load_user_by_id(connection, user["id"])
    return await issue_token_pair(connection, current_user, user_agent, x_device_name)


@router.post("/email/backup", response_model=UserResponse)
async def set_backup_email(
    payload: BackupEmailRequest,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> UserResponse:
    backup_email = normalize_email(payload.backupEmail)
    if backup_email == current_user["email"]:
        raise _http_bad_request("Backup email must be different from primary email")
    await connection.execute(
        update(users)
        .where(users.c.id == current_user["id"])
        .values(
            backup_email=backup_email,
            backup_email_verified_at=None,
            backup_email_added_at=datetime.now(timezone.utc),
        )
    )
    row = await _load_user_by_id(connection, current_user["id"])
    return await user_response(connection, row)


@router.delete("/email/backup", response_model=UserResponse)
async def remove_backup_email(
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> UserResponse:
    await connection.execute(
        update(users)
        .where(users.c.id == current_user["id"])
        .values(
            backup_email=None,
            backup_email_verified_at=None,
            backup_email_added_at=None,
        )
    )
    row = await _load_user_by_id(connection, current_user["id"])
    return await user_response(connection, row)


@router.post("/email/backup/request-code", response_model=CodeRequestResponse)
async def request_backup_email_code(
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> CodeRequestResponse:
    backup_email = current_user.get("backup_email")
    if not backup_email:
        raise _http_bad_request("Backup email is not set")
    try:
        issued = await issue_email_code(
            connection,
            email=backup_email,
            purpose=VERIFY_BACKUP_EMAIL_PURPOSE,
            user_id=current_user["id"],
        )
    except Exception as error:
        _handle_code_errors(error)
        raise
    return await _queue_email_delivery(connection, issued)


@router.post("/email/backup/verify-code", response_model=UserResponse)
async def verify_backup_email_code(
    payload: VerifyCodeRequest,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> UserResponse:
    backup_email = current_user.get("backup_email")
    if not backup_email:
        raise _http_bad_request("Backup email is not set")
    normalized_backup = normalize_email(backup_email)
    if await _email_exists_as_primary(connection, normalized_backup, exclude_user_id=current_user["id"]):
        raise _http_conflict("Email already in use")
    if await _email_exists_as_confirmed_backup(connection, normalized_backup, exclude_user_id=current_user["id"]):
        raise _http_conflict("Email already in use")
    try:
        await verify_email_code(
            connection,
            email=normalized_backup,
            purpose=VERIFY_BACKUP_EMAIL_PURPOSE,
            code=payload.code,
            user_id=current_user["id"],
        )
    except Exception as error:
        _handle_code_errors(error)
        raise
    await connection.execute(
        update(users)
        .where(users.c.id == current_user["id"])
        .values(backup_email=normalized_backup, backup_email_verified_at=datetime.now(timezone.utc))
    )
    row = await _load_user_by_id(connection, current_user["id"])
    return await user_response(connection, row)


@router.post("/email/primary/request-change", response_model=CodeRequestResponse)
async def request_primary_email_change(
    payload: PrimaryEmailChangeRequest,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> CodeRequestResponse:
    new_email = normalize_email(payload.newEmail)
    if new_email == current_user["email"]:
        raise _http_bad_request("New email must be different")
    if await _email_exists_as_primary(connection, new_email, exclude_user_id=current_user["id"]):
        raise _http_conflict("Email already in use")
    if await _email_exists_as_confirmed_backup(connection, new_email, exclude_user_id=current_user["id"]):
        raise _http_conflict("Email already in use")
    try:
        issued = await issue_email_code(
            connection,
            email=new_email,
            purpose=CHANGE_PRIMARY_EMAIL_PURPOSE,
            user_id=current_user["id"],
        )
    except Exception as error:
        _handle_code_errors(error)
        raise
    return await _queue_email_delivery(connection, issued)


@router.post("/email/primary/verify-change", response_model=UserResponse)
async def verify_primary_email_change(
    payload: PrimaryEmailVerifyRequest,
    current_user: dict = Depends(get_current_user),
    connection: AsyncConnection = Depends(get_connection),
) -> UserResponse:
    new_email = normalize_email(payload.newEmail)
    if await _email_exists_as_primary(connection, new_email, exclude_user_id=current_user["id"]):
        raise _http_conflict("Email already in use")
    if await _email_exists_as_confirmed_backup(connection, new_email, exclude_user_id=current_user["id"]):
        raise _http_conflict("Email already in use")
    try:
        await verify_email_code(
            connection,
            email=new_email,
            purpose=CHANGE_PRIMARY_EMAIL_PURPOSE,
            code=payload.code,
            user_id=current_user["id"],
        )
    except Exception as error:
        _handle_code_errors(error)
        raise

    row = await _load_user_by_id(connection, current_user["id"])
    values = {
        "email": new_email,
        "email_verified_at": datetime.now(timezone.utc),
    }
    if row.get("backup_email") == new_email:
        values["backup_email"] = None
        values["backup_email_verified_at"] = None
        values["backup_email_added_at"] = None
    await connection.execute(update(users).where(users.c.id == current_user["id"]).values(**values))
    updated = await _load_user_by_id(connection, current_user["id"])
    return await user_response(connection, updated)


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
        "email_verified_at": session["email_verified_at"],
        "backup_email": session["backup_email"],
        "backup_email_verified_at": session["backup_email_verified_at"],
        "display_name": session["display_name"],
        "avatar_file_id": session["avatar_file_id"],
        "created_at": session["created_at"],
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
