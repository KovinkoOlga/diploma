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
  if (!text) return null;

  const trimmed = text.trim();
  const looksLikeJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));

  if (!looksLikeJson) {
    return { rawText: text };
  }

  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

const FIELD_LABELS = {
  title: "название",
  catalogId: "каталог",
  categoryId: "категория",
  subcategory: "подкатегория",
  primaryImageFileId: "изображение вещи",
  status: "статус",
};

function isServerErrorText(text) {
  const trimmed = String(text ?? "").trim();
  return !trimmed || /^internal server error/i.test(trimmed) || trimmed.startsWith("<");
}

function sanitizeErrorText(text) {
  const trimmed = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (isServerErrorText(trimmed)) {
    return "Ошибка сервера. Попробуйте ещё раз.";
  }
  if (/json parse error|pydantic|validation error|traceback|itempayload/i.test(trimmed)) {
    return "Проверьте заполнение обязательных полей.";
  }
  return trimmed;
}

function formatValidationDetails(detail) {
  if (!Array.isArray(detail) || !detail.length) return "";

  const labels = [];
  for (const entry of detail) {
    const location = Array.isArray(entry?.loc) ? entry.loc : [];
    const fieldName = [...location].reverse().find((part) => typeof part === "string" && FIELD_LABELS[part]);
    const label = FIELD_LABELS[fieldName];
    if (label && !labels.includes(label)) {
      labels.push(label);
    }
  }

  if (labels.length) {
    return `Проверьте обязательные поля: ${labels.join(", ")}`;
  }

  return "Проверьте корректность заполнения полей.";
}

function buildErrorMessage(response, payload) {
  const detail = payload?.detail;
  if (Array.isArray(detail)) {
    const validationMessage = formatValidationDetails(detail);
    if (validationMessage) return validationMessage;
  }

  if (typeof detail === "string" && detail.trim()) {
    return sanitizeErrorText(detail);
  }

  if (typeof payload?.message === "string" && payload.message.trim()) {
    return sanitizeErrorText(payload.message);
  }

  if (typeof payload?.rawText === "string" && payload.rawText.trim()) {
    return sanitizeErrorText(payload.rawText);
  }

  if (response.status >= 500) {
    return "Ошибка сервера. Попробуйте ещё раз.";
  }

  return "Не удалось выполнить запрос. Попробуйте ещё раз.";
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
    throw new Error(buildErrorMessage(response, payload));
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
