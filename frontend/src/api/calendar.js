import { apiDelete, apiGet, apiPut } from "./client";

function normalizeOutfitPreview(entity) {
  if (!entity) return null;
  return {
    ...entity,
    itemIds: entity.item_ids ?? [],
    coverImage: entity.cover_image_url ? { uri: entity.cover_image_url } : null,
    coverTransparentImage: entity.cover_transparent_image_url ? { uri: entity.cover_transparent_image_url } : null,
  };
}

function normalizeItemPreview(entity) {
  if (!entity) return null;
  return {
    id: entity.id,
    title: entity.title ?? "",
    categoryId: entity.category_id ?? "",
    subcategory: entity.subcategory ?? "",
    image: entity.image_url ? { uri: entity.image_url } : null,
    imageUrl: entity.image_url ?? null,
  };
}

function normalizeCalendarEntry(entity) {
  if (!entity) return null;
  return {
    ...entity,
    weatherSnapshotJson: entity.weather_snapshot_json ?? null,
    outfit: normalizeOutfitPreview(entity.outfit),
    items: (entity.items ?? []).map(normalizeItemPreview).filter(Boolean),
    hasContent: Boolean(entity.has_content ?? entity.outfit ?? (entity.items ?? []).length),
  };
}

export async function fetchCalendarEntries({ dateFrom, dateTo }) {
  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
  });
  const items = await apiGet(`/outfit-calendar?${params.toString()}`);
  return (items ?? []).map(normalizeCalendarEntry);
}

export async function fetchCalendarDay(date) {
  return normalizeCalendarEntry(await apiGet(`/outfit-calendar/day?date=${date}`));
}

export async function assignOutfitToDay(payload) {
  return normalizeCalendarEntry(await apiPut("/outfit-calendar/day", payload));
}

export async function deleteOutfitFromDay(date) {
  return apiDelete(`/outfit-calendar/day?date=${date}`);
}
