import logging
import smtplib

from celery.utils.log import get_task_logger

from app.core.config import get_settings
from app.modules.auth.email_sender import send_email_code
from app.tasks.celery_app import celery_app


logger = get_task_logger(__name__)
fallback_logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="send_email_code_task",
    autoretry_for=(smtplib.SMTPException, OSError, RuntimeError),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    retry_kwargs={"max_retries": 3},
)
def send_email_code_task(self, email: str, code: str, purpose: str) -> None:
    settings = get_settings()
    try:
        send_email_code(email, code, purpose)
    except RuntimeError:
        if settings.is_production:
            logger.error("Email delivery configuration error for purpose=%s email=%s", purpose, email)
            raise
        fallback_logger.warning("Email code fallback source=celery-task purpose=%s email=%s code=%s", purpose, email, code)
    except Exception:
        logger.exception("Failed to deliver email code for purpose=%s email=%s", purpose, email)
        raise
