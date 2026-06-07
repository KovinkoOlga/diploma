import { apiDelete, apiGet, apiPatch, apiPost, apiPostPublic, getRefreshToken } from "./client";

export function requestLoginCode(email) {
  return apiPostPublic("/auth/login/request-code", { email });
}

export function verifyLoginCode(email, code) {
  return apiPostPublic("/auth/login/verify-code", { email, code });
}

export function requestRegisterCode(email) {
  return apiPostPublic("/auth/register/request-code", { email });
}

export function verifyRegisterCode(email, code) {
  return apiPostPublic("/auth/register/verify-code", { email, code });
}

export function setBackupEmail(backupEmail) {
  return apiPost("/auth/email/backup", { backupEmail });
}

export function deleteBackupEmail() {
  return apiDelete("/auth/email/backup");
}

export function requestBackupEmailCode() {
  return apiPost("/auth/email/backup/request-code", {});
}

export function verifyBackupEmailCode(code) {
  return apiPost("/auth/email/backup/verify-code", { code });
}

export function requestPrimaryEmailChange(newEmail) {
  return apiPost("/auth/email/primary/request-change", { newEmail });
}

export function verifyPrimaryEmailChange(newEmail, code) {
  return apiPost("/auth/email/primary/verify-change", { newEmail, code });
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

export function uploadAvatar(fileAsset) {
  const formData = new FormData();
  const fallbackName = fileAsset?.uri?.split("/").pop() || "avatar.jpg";
  formData.append("file", {
    uri: fileAsset.uri,
    name: fileAsset.fileName || fallbackName,
    type: fileAsset.mimeType || "image/jpeg",
  });
  return apiPost("/users/me/avatar", formData);
}
