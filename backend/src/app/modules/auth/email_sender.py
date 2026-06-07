import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings


logger = logging.getLogger(__name__)


PURPOSE_SUBJECTS = {
    "register": "Код регистрации",
    "login": "Код входа",
    "verify_backup_email": "Подтверждение резервной почты",
    "change_primary_email": "Подтверждение новой почты",
}


def log_dev_email_code(email: str, code: str, purpose: str, *, source: str) -> None:
    logger.warning("Email code fallback source=%s purpose=%s email=%s code=%s", source, purpose, email, code)


def send_email_code(email: str, code: str, purpose: str) -> None:
    settings = get_settings()
    if not settings.smtp_configured:
        if settings.is_local_or_dev:
            log_dev_email_code(email, code, purpose, source="smtp-missing")
            return
        logger.error("SMTP is not configured for purpose=%s email=%s", purpose, email)
        raise RuntimeError("SMTP is not configured")

    ttl_minutes = max(1, settings.email_code_ttl_seconds // 60)
    subject = PURPOSE_SUBJECTS.get(purpose, "Код подтверждения")
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                f"Ваш код: {code}",
                f"Код действует {ttl_minutes} минут.",
                "Не передавайте этот код другим людям.",
            ]
        )
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
