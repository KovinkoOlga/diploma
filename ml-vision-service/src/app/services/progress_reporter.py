from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from urllib import error, request

from app.core.config import get_settings


logger = logging.getLogger(__name__)


@dataclass
class ProgressReporter:
    draft_id: str
    callback_url: str
    token: str

    def report(self, status: str, message: str) -> None:
        payload = json.dumps(
            {
                "status": status,
                "message": message,
                "source": "ml-vision-service",
            }
        ).encode("utf-8")
        req = request.Request(
            self.callback_url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Internal-Service-Token": self.token,
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=get_settings().internal_callback_timeout_seconds):
                return
        except (error.HTTPError, error.URLError, TimeoutError, OSError) as exc:
            logger.warning(
                "Progress callback failed for draft %s status %s: %s",
                self.draft_id,
                status,
                exc,
            )
