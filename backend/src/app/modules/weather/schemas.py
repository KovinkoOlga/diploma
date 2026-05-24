from pydantic import BaseModel


class CurrentWeatherResponse(BaseModel):
    temperature: float
    feels_like: float | None = None
    condition_code: int
    condition_text: str
    precipitation_probability: int | None = None
    rain_expected: bool
    recommendation_text: str
    fetched_at: str
