import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

function appendArray(params, key, value) {
  if (!value) return;
  const values = Array.isArray(value) ? value : [value];
  values.filter(Boolean).forEach((entry) => params.append(key, entry));
}

export function normalizeRemoteImage(entity) {
  if (!entity) return entity;
  if (entity.image && typeof entity.image === "string") {
    return { ...entity, image: { uri: entity.image } };
  }
  return entity;
}

export async function fetchBootstrap() {
  return apiGet("/wardrobe/bootstrap");
}

export async function fetchItems(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.includeArchived) params.set("includeArchived", "true");
  appendArray(params, "catalogId", filters.catalogId);
  appendArray(params, "categoryId", filters.categoryId);
  appendArray(params, "subcategory", filters.subcategory);
  appendArray(params, "color", filters.color);
  appendArray(params, "season", filters.season);
  appendArray(params, "style", filters.style);
  appendArray(params, "brand", filters.brand);
  appendArray(params, "status", filters.status);
  if (filters.outfitParticipation) params.set("outfitParticipation", filters.outfitParticipation);
  const suffix = params.toString() ? `?${params}` : "";
  const items = await apiGet(`/wardrobe/items${suffix}`);
  return items.map(normalizeRemoteImage);
}

export async function createItem(payload) {
  return normalizeRemoteImage(await apiPost("/wardrobe/items", payload));
}

export async function updateItem(itemId, payload) {
  return normalizeRemoteImage(await apiPatch(`/wardrobe/items/${itemId}`, payload));
}

export async function deleteItem(itemId) {
  return apiDelete(`/wardrobe/items/${itemId}`);
}

export async function bulkUpdateItems(itemIds, patch) {
  const items = await apiPost("/wardrobe/items/bulk-update", { itemIds, patch });
  return items.map(normalizeRemoteImage);
}

export async function bulkDeleteItems(itemIds) {
  return apiPost("/wardrobe/items/bulk-delete", { itemIds });
}

export async function createCatalog(title) {
  return apiPost("/wardrobe/catalogs", { title });
}

export async function updateCatalog(catalogId, title) {
  return apiPatch(`/wardrobe/catalogs/${catalogId}`, { title });
}

export async function fetchDictionaries() {
  return apiGet("/wardrobe/dictionaries");
}

export async function updateSubcategory(subcategoryId, name) {
  return apiPatch(`/wardrobe/subcategories/${subcategoryId}`, { name });
}

export async function deleteSubcategory(subcategoryId) {
  return apiDelete(`/wardrobe/subcategories/${subcategoryId}`);
}

export async function updateStyle(styleId, name) {
  return apiPatch(`/wardrobe/styles/${styleId}`, { name });
}

export async function deleteStyle(styleId) {
  return apiDelete(`/wardrobe/styles/${styleId}`);
}

export async function updateBrand(brandId, name) {
  return apiPatch(`/wardrobe/brands/${brandId}`, { name });
}

export async function deleteBrand(brandId) {
  return apiDelete(`/wardrobe/brands/${brandId}`);
}

export async function createDraft(payload) {
  return apiPost("/wardrobe/drafts", payload);
}

export async function uploadDraftImage({ sourceType, catalogId, asset }) {
  const formData = new FormData();
  const fallbackName = asset?.uri?.split("/").pop() || "wardrobe-image.jpg";
  formData.append("sourceType", sourceType);
  formData.append("catalogId", catalogId);
  formData.append("file", {
    uri: asset.uri,
    name: asset.fileName || fallbackName,
    type: asset.mimeType || "image/jpeg",
  });
  return apiPost("/wardrobe/drafts/upload", formData);
}

export async function createDraftFromTemplate(templateId, catalogId) {
  return apiPost("/wardrobe/drafts/from-template", { sourceType: "catalog", templateId, catalogId });
}

export async function fetchDraft(draftId) {
  const draft = await apiGet(`/wardrobe/drafts/${draftId}`);
  if (draft?.draft) {
    draft.draft = normalizeRemoteImage(draft.draft);
  }
  return draft;
}

export async function enhanceDraft(draftId) {
  const draft = await apiPost(`/wardrobe/drafts/${draftId}/enhance`);
  if (draft?.draft) {
    draft.draft = normalizeRemoteImage(draft.draft);
  }
  return draft;
}

export async function editDraftMask(draftId, { maskFile, maskImageBase64, flipHorizontal, rotationDegrees }) {
  const formData = new FormData();
  formData.append("flipHorizontal", flipHorizontal ? "true" : "false");
  formData.append("rotationDegrees", String(rotationDegrees ?? 0));
  if (maskFile) {
    formData.append("mask", maskFile);
  } else if (maskImageBase64) {
    formData.append("maskImageBase64", maskImageBase64);
  }
  const draft = await apiPost(`/wardrobe/drafts/${draftId}/mask-edit`, formData);
  if (draft?.draft) {
    draft.draft = normalizeRemoteImage(draft.draft);
  }
  return draft;
}

export async function confirmDraft(draftId, payload) {
  return normalizeRemoteImage(await apiPost(`/wardrobe/drafts/${draftId}/confirm`, payload));
}
