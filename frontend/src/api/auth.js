import { apiGet, apiPatch, apiPost, apiPostPublic, getRefreshToken } from "./client";

export function login(credentials) {
  return apiPostPublic("/auth/login", credentials);
}

export function register(credentials) {
  return apiPostPublic("/auth/register", credentials);
}

export function refresh(refreshToken) {
  return apiPostPublic("/auth/refresh", { refreshToken });
}

export function logout(refreshToken = getRefreshToken()) {
  return apiPostPublic("/auth/logout", { refreshToken });
}

export function logoutAll() {
  return apiPost("/auth/logout-all", {});
}

export function me() {
  return apiGet("/auth/me");
}

export function updateProfile(payload) {
  return apiPatch("/users/me", payload);
}

export function changePassword(payload) {
  return apiPost("/auth/change-password", payload);
}
