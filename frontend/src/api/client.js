const DEFAULT_API_URL = "http://localhost:8000";

let accessToken = null;
let refreshToken = null;
let refreshPromise = null;
let authHandlers = {
  onTokens: null,
  onUnauthorized: null,
};

function getBaseUrl() {
  return process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;
}

export function configureAuthHandlers(handlers) {
  authHandlers = { ...authHandlers, ...handlers };
}

export function setAuthTokens(tokens = {}) {
  accessToken = tokens.accessToken ?? accessToken;
  refreshToken = tokens.refreshToken ?? refreshToken;
}

export function clearAuthTokens() {
  accessToken = null;
  refreshToken = null;
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function buildBody(body) {
  if (body instanceof FormData) return body;
  return JSON.stringify(body ?? {});
}

async function rawRequest(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers ?? {}),
  };
  if (!options.skipAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
  });
  const payload = await parseResponse(response);
  return { response, payload };
}

async function refreshSession() {
  if (!refreshToken) throw new Error("Missing refresh token");
  if (!refreshPromise) {
    refreshPromise = rawRequest("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuth: true,
    })
      .then(async ({ response, payload }) => {
        if (!response.ok) throw new Error("Unable to refresh session");
        setAuthTokens(payload);
        await authHandlers.onTokens?.(payload);
        return payload;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request(path, options = {}, retry = true) {
  const { response, payload } = await rawRequest(path, options);

  if (response.status === 401 && retry && !options.skipAuth) {
    try {
      await refreshSession();
      return request(path, options, false);
    } catch (error) {
      clearAuthTokens();
      await authHandlers.onUnauthorized?.();
      throw error;
    }
  }

  if (!response.ok) {
    const message = payload?.detail || payload?.message || "API request failed";
    throw new Error(Array.isArray(message) ? message.map((entry) => entry.msg).join(", ") : message);
  }

  return payload;
}

export async function apiGet(path) {
  return request(path);
}

export async function apiPost(path, body, options = {}) {
  return request(path, { ...options, method: "POST", body: buildBody(body) });
}

export async function apiPatch(path, body) {
  return request(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
}

export async function apiDelete(path) {
  return request(path, { method: "DELETE" });
}

export async function apiPostPublic(path, body) {
  return request(path, { method: "POST", body: JSON.stringify(body ?? {}), skipAuth: true }, false);
}

