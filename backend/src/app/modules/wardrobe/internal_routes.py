import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.config import get_settings
from app.db.database import get_connection
from app.modules.wardrobe import service
from app.modules.wardrobe.schemas import InternalDraftProgressPayload


router = APIRouter(prefix="/internal/wardrobe", tags=["internal-wardrobe"])


def _validate_internal_service_token(token: str | None = Header(None, alias="X-Internal-Service-Token")) -> None:
    expected_token = get_settings().internal_service_token
    if not token or not expected_token or not hmac.compare_digest(token, expected_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.post("/drafts/{draft_id}/progress")
async def update_draft_progress(
    draft_id: str,
    payload: InternalDraftProgressPayload,
    _: None = Depends(_validate_internal_service_token),
    connection: AsyncConnection = Depends(get_connection),
) -> dict[str, str]:
    try:
        draft = await service.apply_internal_draft_progress(connection, draft_id, payload.status)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")
    return {"draftId": draft_id, "processingStatus": str(draft["processing_status"])}
