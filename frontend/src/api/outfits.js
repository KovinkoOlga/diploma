import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export function fetchOutfits() {
  return apiGet("/outfits");
}

export function createOutfit(payload) {
  return apiPost("/outfits", payload);
}

export function updateOutfit(outfitId, payload) {
  return apiPatch(`/outfits/${outfitId}`, payload);
}

export function deleteOutfit(outfitId) {
  return apiDelete(`/outfits/${outfitId}`);
}

