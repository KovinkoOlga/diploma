from datetime import datetime, timezone

import httpx

from app.core.config import get_settings
from app.modules.weather.schemas import CurrentWeatherResponse


RAIN_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82}
SNOW_CODES = {71, 73, 75, 77, 85, 86}
FOG_CODES = {45, 48}
OVERCAST_CODES = {1, 2, 3}
THUNDER_CODES = {95, 96, 99}

CONDITION_TEXT = {
    0: "Ясно",
    1: "Преимущественно ясно",
    2: "Переменная облачность",
    3: "Пасмурно",
    45: "Туман",
    48: "Изморозь",
    51: "Слабая морось",
    53: "Морось",
    55: "Сильная морось",
    56: "Ледяная морось",
    57: "Сильная ледяная морось",
    61: "Слабый дождь",
    63: "Дождь",
    65: "Сильный дождь",
    66: "Ледяной дождь",
    67: "Сильный ледяной дождь",
    71: "Слабый снег",
    73: "Снег",
    75: "Сильный снег",
    77: "Снежные зерна",
    80: "Ливень",
    81: "Ливень",
    82: "Сильный ливень",
    85: "Слабый снегопад",
    86: "Сильный снегопад",
    95: "Гроза",
    96: "Гроза с градом",
    99: "Сильная гроза с градом",
}


def condition_text(condition_code: int) -> str:
    return CONDITION_TEXT.get(condition_code, "Погодные условия")


def build_recommendation(temperature: float, condition_code: int, rain_expected: bool) -> str:
    if rain_expected or condition_code in THUNDER_CODES:
        return "Стоит выбрать закрытую обувь и верхний слой"
    if temperature <= 8:
        return "Лучше выбрать тёплый образ или верхний слой"
    if temperature >= 24:
        return "Сегодня подойдут лёгкие вещи"
    if condition_code in OVERCAST_CODES or condition_code in FOG_CODES or temperature <= 15:
        return "Можно выбрать образ с дополнительным слоем"
    return "Подойдёт комфортный образ без лишних слоёв"


def _hourly_precipitation_probability(payload: dict, current_time: str | None) -> int | None:
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    values = hourly.get("precipitation_probability") or []
    if not current_time or not times or not values:
        return None
    try:
        index = times.index(current_time)
    except ValueError:
        return None
    if index >= len(values):
        return None
    value = values[index]
    if value is None:
        return None
    return int(round(float(value)))


async def get_current_weather(latitude: float, longitude: float) -> CurrentWeatherResponse:
    settings = get_settings()
    timeout = httpx.Timeout(20.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            f"{settings.weather_api_base_url}/forecast",
            params={
                "latitude": latitude,
                "longitude": longitude,
                "current": ",".join(
                    [
                        "temperature_2m",
                        "apparent_temperature",
                        "weather_code",
                        "rain",
                        "showers",
                        "snowfall",
                    ]
                ),
                "hourly": "precipitation_probability",
                "timezone": "auto",
                "forecast_days": 1,
            },
        )
        response.raise_for_status()
    payload = response.json()
    current = payload.get("current") or {}
    if not current:
        raise ValueError("Weather payload is missing current section")

    temperature = float(current.get("temperature_2m"))
    feels_like = current.get("apparent_temperature")
    condition_code_value = int(current.get("weather_code", -1))
    precipitation_probability = _hourly_precipitation_probability(payload, current.get("time"))
    rain_expected = (
        condition_code_value in RAIN_CODES
        or condition_code_value in SNOW_CODES
        or float(current.get("rain") or 0) > 0
        or float(current.get("showers") or 0) > 0
        or float(current.get("snowfall") or 0) > 0
        or (precipitation_probability or 0) >= 40
    )

    return CurrentWeatherResponse(
        temperature=temperature,
        feels_like=float(feels_like) if feels_like is not None else None,
        condition_code=condition_code_value,
        condition_text=condition_text(condition_code_value),
        precipitation_probability=precipitation_probability,
        rain_expected=rain_expected,
        recommendation_text=build_recommendation(temperature, condition_code_value, rain_expected),
        fetched_at=datetime.now(timezone.utc).isoformat(),
    )
