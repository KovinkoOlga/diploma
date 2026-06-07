import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.config import get_settings
from app.db.metadata import email_verification_codes


REGISTER_CODE_PURPOSE = "register"
LOGIN_CODE_PURPOSE = "login"
VERIFY_BACKUP_EMAIL_PURPOSE = "verify_backup_email"
CHANGE_PRIMARY_EMAIL_PURPOSE = "change_primary_email"

DELIVERY_FAILED_REASON = "delivery_failed"
REPLACED_REASON = "replaced"
VERIFIED_REASON = "verified"
ATTEMPTS_EXCEEDED_REASON = "attempts_exceeded"


class EmailCodeError(Exception):
    pass


class EmailCodeCooldownError(EmailCodeError):
    def __init__(self, cooldown_seconds: int, next_resend_at: datetime) -> None:
        super().__init__("Resend available later")
        self.cooldown_seconds = cooldown_seconds
        self.next_resend_at = next_resend_at


class EmailCodeVerificationError(EmailCodeError):
    pass


@dataclass
class IssuedEmailCode:
    code_id: str
    email: str
    purpose: str
    user_id: str | None
    plain_code: str
    cooldown_seconds: int
    next_resend_at: datetime
    dev_code: str | None


def normalize_email(email: str) -> str:
    return email.strip().lower()


def generate_email_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_email_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def should_return_dev_code() -> bool:
    settings = get_settings()
    return settings.auth_dev_return_email_code and not settings.is_production


def _code_scope_filters(email: str, purpose: str, user_id: str | None) -> list[Any]:
    filters: list[Any] = [
        email_verification_codes.c.email == email,
        email_verification_codes.c.purpose == purpose,
    ]
    if user_id is None:
        filters.append(email_verification_codes.c.user_id.is_(None))
    else:
        filters.append(email_verification_codes.c.user_id == user_id)
    return filters


async def _load_code_chain(
    connection: AsyncConnection,
    *,
    email: str,
    purpose: str,
    user_id: str | None,
) -> list[dict[str, Any]]:
    rows = (
        await connection.execute(
            select(email_verification_codes)
            .where(*_code_scope_filters(email, purpose, user_id))
            .order_by(desc(email_verification_codes.c.created_at))
        )
    ).mappings().all()
    return [dict(row) for row in rows]


def _metadata_reason(row: dict[str, Any]) -> str | None:
    metadata = row.get("metadata_json") or {}
    if isinstance(metadata, dict):
        reason = metadata.get("reason")
        return str(reason) if reason else None
    return None


def _is_delivery_failed(row: dict[str, Any]) -> bool:
    return _metadata_reason(row) == DELIVERY_FAILED_REASON


def _is_consumed(row: dict[str, Any]) -> bool:
    return row.get("consumed_at") is not None


def _is_expired(row: dict[str, Any], now: datetime) -> bool:
    return row["expires_at"] <= now


def _has_attempts_remaining(row: dict[str, Any]) -> bool:
    return int(row.get("attempts_count") or 0) < get_settings().email_code_max_attempts


def _is_usable(row: dict[str, Any], now: datetime) -> bool:
    return not _is_consumed(row) and not _is_expired(row, now) and _has_attempts_remaining(row)


def _cooldown_seconds(next_resend_at: datetime, now: datetime) -> int:
    return max(0, int((next_resend_at - now).total_seconds()))


def _cooldown_for_resend_count(resend_count: int) -> int:
    settings = get_settings()
    return min(
        settings.email_code_resend_initial_seconds * (2**max(0, resend_count)),
        settings.email_code_resend_max_seconds,
    )


async def mark_code_unusable(
    connection: AsyncConnection,
    code_id: str,
    *,
    reason: str,
    clear_cooldown: bool = False,
) -> None:
    now = datetime.now(timezone.utc)
    values: dict[str, Any] = {"consumed_at": now, "metadata_json": {"reason": reason}}
    if clear_cooldown:
        values["next_resend_at"] = None
    await connection.execute(update(email_verification_codes).where(email_verification_codes.c.id == code_id).values(**values))


async def issue_email_code(
    connection: AsyncConnection,
    *,
    email: str,
    purpose: str,
    user_id: str | None,
) -> IssuedEmailCode:
    normalized_email = normalize_email(email)
    now = datetime.now(timezone.utc)
    rows = await _load_code_chain(connection, email=normalized_email, purpose=purpose, user_id=user_id)

    last_delivered_row = next((row for row in rows if not _is_delivery_failed(row)), None)
    if last_delivered_row and last_delivered_row.get("next_resend_at") and last_delivered_row["next_resend_at"] > now:
        raise EmailCodeCooldownError(
            cooldown_seconds=_cooldown_seconds(last_delivered_row["next_resend_at"], now),
            next_resend_at=last_delivered_row["next_resend_at"],
        )

    active_ids = [row["id"] for row in rows if _is_usable(row, now)]
    if active_ids:
        await connection.execute(
            update(email_verification_codes)
            .where(email_verification_codes.c.id.in_(active_ids))
            .values(consumed_at=now, metadata_json={"reason": REPLACED_REASON})
        )

    resend_count = (int(last_delivered_row["resend_count"]) + 1) if last_delivered_row else 0
    cooldown_seconds = _cooldown_for_resend_count(resend_count)
    plain_code = generate_email_code()
    code_id = f"email_code_{uuid4().hex}"
    next_resend_at = now + timedelta(seconds=cooldown_seconds)
    expires_at = now + timedelta(seconds=get_settings().email_code_ttl_seconds)

    await connection.execute(
        email_verification_codes.insert().values(
            id=code_id,
            user_id=user_id,
            email=normalized_email,
            purpose=purpose,
            code_hash=hash_email_code(plain_code),
            expires_at=expires_at,
            attempts_count=0,
            resend_count=resend_count,
            next_resend_at=next_resend_at,
        )
    )
    return IssuedEmailCode(
        code_id=code_id,
        email=normalized_email,
        purpose=purpose,
        user_id=user_id,
        plain_code=plain_code,
        cooldown_seconds=cooldown_seconds,
        next_resend_at=next_resend_at,
        dev_code=plain_code if should_return_dev_code() else None,
    )


async def verify_email_code(
    connection: AsyncConnection,
    *,
    email: str,
    purpose: str,
    code: str,
    user_id: str | None,
) -> dict[str, Any]:
    normalized_email = normalize_email(email)
    rows = await _load_code_chain(connection, email=normalized_email, purpose=purpose, user_id=user_id)
    now = datetime.now(timezone.utc)
    candidate = next((row for row in rows if _is_usable(row, now)), None)

    if candidate is None:
        exhausted = next(
            (
                row
                for row in rows
                if not _is_consumed(row) and not _is_expired(row, now) and not _has_attempts_remaining(row)
            ),
            None,
        )
        if exhausted is not None:
            raise EmailCodeVerificationError("Too many attempts")
        expired = next((row for row in rows if not _is_consumed(row) and _is_expired(row, now)), None)
        if expired is not None:
            raise EmailCodeVerificationError("Code has expired")
        raise EmailCodeVerificationError("Code is invalid")

    if candidate["code_hash"] != hash_email_code(code):
        attempts_count = int(candidate.get("attempts_count") or 0) + 1
        values: dict[str, Any] = {"attempts_count": attempts_count}
        if attempts_count >= get_settings().email_code_max_attempts:
            values["consumed_at"] = now
            values["metadata_json"] = {"reason": ATTEMPTS_EXCEEDED_REASON}
        await connection.execute(
            update(email_verification_codes)
            .where(email_verification_codes.c.id == candidate["id"])
            .values(**values)
        )
        if attempts_count >= get_settings().email_code_max_attempts:
            raise EmailCodeVerificationError("Too many attempts")
        raise EmailCodeVerificationError("Code is invalid")

    await connection.execute(
        update(email_verification_codes)
        .where(email_verification_codes.c.id == candidate["id"])
        .values(consumed_at=now, metadata_json={"reason": VERIFIED_REASON})
    )
    candidate["consumed_at"] = now
    return candidate
