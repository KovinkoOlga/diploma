from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.db.metadata import email_verification_codes, metadata, refresh_sessions, users
import app.modules.auth.routes as auth_routes
from app.modules.auth.routes import (
    logout_all,
    refresh,
    request_backup_email_code,
    request_login_code,
    request_primary_email_change,
    request_register_code,
    set_backup_email,
    verify_backup_email_code,
    verify_login_code,
    verify_primary_email_change,
    verify_register_code,
)
from app.modules.auth.schemas import (
    BackupEmailRequest,
    EmailCodeVerifyRequest,
    EmailRequest,
    PrimaryEmailChangeRequest,
    PrimaryEmailVerifyRequest,
    RefreshRequest,
    VerifyCodeRequest,
)


@pytest.fixture()
async def connection(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(metadata.create_all)

    async with engine.connect() as connection:
        settings = get_settings()
        original = {
            "environment": settings.environment,
            "auth_dev_return_email_code": settings.auth_dev_return_email_code,
            "smtp_host": settings.smtp_host,
            "smtp_from_email": settings.smtp_from_email,
            "email_code_max_attempts": settings.email_code_max_attempts,
        }
        settings.environment = "local"
        settings.auth_dev_return_email_code = True
        settings.smtp_host = ""
        settings.smtp_from_email = ""
        settings.email_code_max_attempts = 5

        monkeypatch.setattr(auth_routes.send_email_code_task, "delay", lambda *args, **kwargs: None)

        yield connection, settings

        settings.environment = original["environment"]
        settings.auth_dev_return_email_code = original["auth_dev_return_email_code"]
        settings.smtp_host = original["smtp_host"]
        settings.smtp_from_email = original["smtp_from_email"]
        settings.email_code_max_attempts = original["email_code_max_attempts"]

    await engine.dispose()


async def load_user(connection, email: str) -> dict:
    row = (await connection.execute(select(users).where(users.c.email == email))).mappings().one()
    return dict(row)


@pytest.mark.asyncio
async def test_register_verify_and_refresh_logout_flow(connection):
    db, _settings = connection

    request_payload = await request_register_code(EmailRequest(email="User@Example.com "), db)
    assert request_payload.devCode

    session = await verify_register_code(
        EmailCodeVerifyRequest(email="user@example.com", code=request_payload.devCode),
        db,
        user_agent="pytest",
        x_device_name="test-device",
    )
    assert session.user.email == "user@example.com"
    assert session.user.emailVerified is True

    refreshed = await refresh(
        RefreshRequest(refreshToken=session.refreshToken),
        db,
        user_agent="pytest",
        x_device_name="refreshed-device",
    )
    assert refreshed.user.email == "user@example.com"
    assert refreshed.refreshToken != session.refreshToken

    current_user = await load_user(db, "user@example.com")
    logout_result = await logout_all(current_user=current_user, connection=db)
    assert logout_result == {"ok": True}

    revoked = (await db.execute(select(refresh_sessions.c.id).where(refresh_sessions.c.revoked_at.is_not(None)))).all()
    assert revoked


@pytest.mark.asyncio
async def test_confirmed_backup_email_can_be_used_for_login(connection):
    db, _settings = connection

    register_payload = await request_register_code(EmailRequest(email="owner@example.com"), db)
    session = await verify_register_code(
        EmailCodeVerifyRequest(email="owner@example.com", code=register_payload.devCode),
        db,
        user_agent="pytest",
        x_device_name="device",
    )

    current_user = await load_user(db, "owner@example.com")
    user_after_backup = await set_backup_email(
        BackupEmailRequest(backupEmail="backup@example.com"),
        current_user=current_user,
        connection=db,
    )
    assert user_after_backup.backupEmailVerified is False

    backup_code_request = await request_backup_email_code(current_user=await load_user(db, "owner@example.com"), connection=db)
    verified_user = await verify_backup_email_code(
        VerifyCodeRequest(code=backup_code_request.devCode),
        current_user=await load_user(db, "owner@example.com"),
        connection=db,
    )
    assert verified_user.backupEmailVerified is True

    login_code_request = await request_login_code(EmailRequest(email="backup@example.com"), db)
    login_session = await verify_login_code(
        EmailCodeVerifyRequest(email="backup@example.com", code=login_code_request.devCode),
        db,
        user_agent="pytest",
        x_device_name="backup-login",
    )
    assert login_session.user.email == "owner@example.com"


@pytest.mark.asyncio
async def test_unconfirmed_backup_email_cannot_be_used_for_login(connection):
    db, _settings = connection

    register_payload = await request_register_code(EmailRequest(email="draft-owner@example.com"), db)
    await verify_register_code(
        EmailCodeVerifyRequest(email="draft-owner@example.com", code=register_payload.devCode),
        db,
        user_agent="pytest",
        x_device_name="device",
    )
    await set_backup_email(
        BackupEmailRequest(backupEmail="draft-backup@example.com"),
        current_user=await load_user(db, "draft-owner@example.com"),
        connection=db,
    )

    with pytest.raises(HTTPException) as exc:
        await request_login_code(EmailRequest(email="draft-backup@example.com"), db)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_wrong_attempts_consume_code_after_limit(connection):
    db, settings = connection
    settings.email_code_max_attempts = 2

    request_payload = await request_register_code(EmailRequest(email="attempts@example.com"), db)

    with pytest.raises(HTTPException) as first_error:
        await verify_register_code(
            EmailCodeVerifyRequest(email="attempts@example.com", code="000000"),
            db,
            user_agent="pytest",
            x_device_name="device",
        )
    assert first_error.value.status_code == 400

    with pytest.raises(HTTPException) as second_error:
        await verify_register_code(
            EmailCodeVerifyRequest(email="attempts@example.com", code="111111"),
            db,
            user_agent="pytest",
            x_device_name="device",
        )
    assert second_error.value.status_code == 429

    with pytest.raises(HTTPException) as final_error:
        await verify_register_code(
            EmailCodeVerifyRequest(email="attempts@example.com", code=request_payload.devCode),
            db,
            user_agent="pytest",
            x_device_name="device",
        )
    assert final_error.value.status_code == 429


@pytest.mark.asyncio
async def test_primary_email_change_is_bound_to_requested_email(connection):
    db, _settings = connection

    register_payload = await request_register_code(EmailRequest(email="change-owner@example.com"), db)
    await verify_register_code(
        EmailCodeVerifyRequest(email="change-owner@example.com", code=register_payload.devCode),
        db,
        user_agent="pytest",
        x_device_name="device",
    )

    current_user = await load_user(db, "change-owner@example.com")
    change_request = await request_primary_email_change(
        PrimaryEmailChangeRequest(newEmail="next@example.com"),
        current_user=current_user,
        connection=db,
    )

    with pytest.raises(HTTPException) as wrong_email_error:
        await verify_primary_email_change(
            PrimaryEmailVerifyRequest(newEmail="other@example.com", code=change_request.devCode),
            current_user=await load_user(db, "change-owner@example.com"),
            connection=db,
        )
    assert wrong_email_error.value.status_code == 400

    changed_user = await verify_primary_email_change(
        PrimaryEmailVerifyRequest(newEmail="next@example.com", code=change_request.devCode),
        current_user=await load_user(db, "change-owner@example.com"),
        connection=db,
    )
    assert changed_user.email == "next@example.com"


@pytest.mark.asyncio
async def test_enqueue_failure_in_production_invalidates_code_without_cooldown_inheritance(connection, monkeypatch):
    db, settings = connection
    settings.environment = "production"
    settings.auth_dev_return_email_code = False

    def failing_delay(*args, **kwargs):
        raise RuntimeError("broker down")

    monkeypatch.setattr(auth_routes.send_email_code_task, "delay", failing_delay)

    with pytest.raises(HTTPException) as failed_request:
        await request_register_code(EmailRequest(email="retry@example.com"), db)
    assert failed_request.value.status_code == 503

    failed_rows = (
        await db.execute(select(email_verification_codes).where(email_verification_codes.c.email == "retry@example.com"))
    ).mappings().all()
    assert failed_rows
    assert failed_rows[-1]["consumed_at"] is not None

    settings.environment = "local"
    settings.auth_dev_return_email_code = True
    monkeypatch.setattr(auth_routes.send_email_code_task, "delay", lambda *args, **kwargs: None)

    retry_request = await request_register_code(EmailRequest(email="retry@example.com"), db)
    assert retry_request.cooldownSeconds == settings.email_code_resend_initial_seconds
    assert retry_request.devCode
