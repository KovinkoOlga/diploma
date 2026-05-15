import { apiGet, apiPost } from "./client";

export function fetchFeed() {
  return apiGet("/content/feed");
}

export function toggleFeedSaved(postId) {
  return apiPost(`/content/feed/${postId}/saved`, {});
}

export function fetchHomeContent() {
  return apiGet("/content/home");
}

