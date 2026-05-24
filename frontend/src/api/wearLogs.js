import { apiGet, apiPost } from "./client";

export function markManualOutfitWear(payload) {
  return apiPost("/wear-logs/outfit", payload);
}

export function markManualItemWear(payload) {
  return apiPost("/wear-logs/items", payload);
}

export async function fetchWearLogs({ dateFrom, dateTo }) {
  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
  });
  return apiGet(`/wear-logs?${params.toString()}`);
}
