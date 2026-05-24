import { apiGet } from "./client";

export function fetchCurrentWeather({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  return apiGet(`/weather/current?${params.toString()}`);
}
