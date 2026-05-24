from fastapi import APIRouter, HTTPException, Query, status

from app.modules.weather.schemas import CurrentWeatherResponse
from app.modules.weather.service import get_current_weather


router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/current", response_model=CurrentWeatherResponse)
async def current_weather(
    latitude: float = Query(...),
    longitude: float = Query(...),
) -> CurrentWeatherResponse:
    try:
        return await get_current_weather(latitude, longitude)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Weather service is temporarily unavailable")
