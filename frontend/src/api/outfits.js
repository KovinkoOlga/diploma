import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

function imageSource(url) {
  return typeof url === "string" && url ? { uri: url } : null;
}

function appendAsset(formData, field, asset, fallbackName = "image.jpg", fallbackType = "image/jpeg") {
  if (!asset?.uri) return;
  const fileName = asset.fileName || asset.name || asset.uri.split("/").pop() || fallbackName;
  const mimeType = asset.mimeType || asset.type || fallbackType;
  formData.append(field, {
    uri: asset.uri,
    name: fileName,
    type: mimeType,
  });
}

export function normalizeRemoteOutfit(entity) {
  if (!entity) return entity;
  return {
    ...entity,
    tags: entity.tags ?? [],
    season: entity.season ?? [],
    collectionIds: entity.collectionIds ?? [],
    collections: entity.collections ?? [],
    coverImage: imageSource(entity.coverImageUrl),
    coverTransparentImage: imageSource(entity.coverTransparentImageUrl),
  };
}

export function normalizeRemoteOutfitCollection(entity) {
  if (!entity) return entity;
  return {
    ...entity,
    title: entity.title ?? "",
    outfitCount: Number(entity.outfitCount ?? 0),
  };
}

export function fetchOutfits() {
  return apiGet("/outfits").then((items) => (items ?? []).map(normalizeRemoteOutfit));
}

export function createOutfit(payload) {
  return apiPost("/outfits", payload).then(normalizeRemoteOutfit);
}

export function updateOutfit(outfitId, payload) {
  return apiPatch(`/outfits/${outfitId}`, payload).then(normalizeRemoteOutfit);
}

export function deleteOutfit(outfitId) {
  return apiDelete(`/outfits/${outfitId}`);
}

export function fetchOutfitCollections() {
  return apiGet("/outfits/collections").then((items) => (items ?? []).map(normalizeRemoteOutfitCollection));
}

export function createOutfitCollection(payload) {
  const body = typeof payload === "string" ? { title: payload } : payload;
  return apiPost("/outfits/collections", body).then(normalizeRemoteOutfitCollection);
}

export function updateOutfitCollection(collectionId, payload) {
  const body = typeof payload === "string" ? { title: payload } : payload;
  return apiPatch(`/outfits/collections/${collectionId}`, body).then(normalizeRemoteOutfitCollection);
}

export function deleteOutfitCollection(collectionId) {
  return apiDelete(`/outfits/collections/${collectionId}`);
}

export function addOutfitsToCollection(collectionId, outfitIds) {
  return apiPost(`/outfits/collections/${collectionId}/outfits`, { outfitIds }).then(normalizeRemoteOutfitCollection);
}

export function removeOutfitFromCollection(collectionId, outfitId) {
  return apiDelete(`/outfits/collections/${collectionId}/outfits/${outfitId}`);
}

export function uploadOutfitCover({ mode, coverAsset, transparentAsset, thumbnailAsset }) {
  const formData = new FormData();
  formData.append("mode", mode ?? "gallery");
  appendAsset(formData, "cover", coverAsset, "outfit-cover.jpg", "image/jpeg");
  appendAsset(formData, "transparentCover", transparentAsset, "outfit-cover-transparent.png", "image/png");
  appendAsset(formData, "thumbnail", thumbnailAsset, "outfit-cover-thumb.jpg", "image/jpeg");
  return apiPost("/outfits/covers/upload", formData);
}
