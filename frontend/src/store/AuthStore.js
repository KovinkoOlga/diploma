import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { clearAuthTokens, configureAuthHandlers, setAuthTokens } from "../api/client";
import * as authApi from "../api/auth";

const ACCESS_TOKEN_KEY = "wardrobe_access_token";
const REFRESH_TOKEN_KEY = "wardrobe_refresh_token";

const AuthContext = createContext(null);

async function saveTokens(tokens) {
  setAuthTokens(tokens);
  if (tokens.accessToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  }
  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

async function clearStoredTokens() {
  clearAuthTokens();
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [authError, setAuthError] = useState("");
  const [pendingBackupOnboarding, setPendingBackupOnboarding] = useState(false);

  const clearSession = useCallback(async () => {
    await clearStoredTokens();
    setCurrentUser(null);
    setPendingBackupOnboarding(false);
  }, []);

  useEffect(() => {
    configureAuthHandlers({
      onTokens: saveTokens,
      onUnauthorized: clearSession,
    });
  }, [clearSession]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (!refreshToken) return;
        setAuthTokens({ accessToken, refreshToken });
        const session = await authApi.refresh(refreshToken);
        await saveTokens(session);
        if (alive) {
          setCurrentUser(session.user);
          setPendingBackupOnboarding(false);
        }
      } catch {
        await clearStoredTokens();
      } finally {
        if (alive) setBootstrapping(false);
      }
    }

    boot();
    return () => {
      alive = false;
    };
  }, []);

  const requestLoginCode = useCallback(async (email) => {
    setAuthError("");
    return authApi.requestLoginCode(email);
  }, []);

  const verifyLoginCode = useCallback(async (email, code) => {
    setAuthError("");
    const session = await authApi.verifyLoginCode(email, code);
    await saveTokens(session);
    setCurrentUser(session.user);
    setPendingBackupOnboarding(false);
    return session.user;
  }, []);

  const requestRegisterCode = useCallback(async (email) => {
    setAuthError("");
    return authApi.requestRegisterCode(email);
  }, []);

  const verifyRegisterCode = useCallback(async (email, code) => {
    setAuthError("");
    const session = await authApi.verifyRegisterCode(email, code);
    await saveTokens(session);
    setCurrentUser(session.user);
    setPendingBackupOnboarding(true);
    return session.user;
  }, []);

  const setBackupEmail = useCallback(async (backupEmail) => {
    const user = await authApi.setBackupEmail(backupEmail);
    setCurrentUser(user);
    return user;
  }, []);

  const deleteBackupEmail = useCallback(async () => {
    const user = await authApi.deleteBackupEmail();
    setCurrentUser(user);
    return user;
  }, []);

  const requestBackupEmailCode = useCallback(async () => authApi.requestBackupEmailCode(), []);

  const verifyBackupEmailCode = useCallback(async (code) => {
    const user = await authApi.verifyBackupEmailCode(code);
    setCurrentUser(user);
    setPendingBackupOnboarding(false);
    return user;
  }, []);

  const requestPrimaryEmailChange = useCallback(async (newEmail) => authApi.requestPrimaryEmailChange(newEmail), []);

  const verifyPrimaryEmailChange = useCallback(async (newEmail, code) => {
    const user = await authApi.verifyPrimaryEmailChange(newEmail, code);
    setCurrentUser(user);
    return user;
  }, []);

  const skipBackupOnboarding = useCallback(() => {
    setPendingBackupOnboarding(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  const updateProfile = useCallback(async (payload) => {
    const user = await authApi.updateProfile(payload);
    setCurrentUser(user);
    return user;
  }, []);

  const uploadAvatar = useCallback(async (fileAsset) => {
    const user = await authApi.uploadAvatar(fileAsset);
    setCurrentUser(user);
    return user;
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      authenticated: Boolean(currentUser),
      bootstrapping,
      authError,
      setAuthError,
      pendingBackupOnboarding,
      requestLoginCode,
      verifyLoginCode,
      requestRegisterCode,
      verifyRegisterCode,
      setBackupEmail,
      deleteBackupEmail,
      requestBackupEmailCode,
      verifyBackupEmailCode,
      requestPrimaryEmailChange,
      verifyPrimaryEmailChange,
      skipBackupOnboarding,
      logout,
      updateProfile,
      uploadAvatar,
      clearSession,
    }),
    [
      authError,
      bootstrapping,
      clearSession,
      currentUser,
      logout,
      pendingBackupOnboarding,
      requestBackupEmailCode,
      requestLoginCode,
      requestPrimaryEmailChange,
      requestRegisterCode,
      setBackupEmail,
      deleteBackupEmail,
      skipBackupOnboarding,
      updateProfile,
      uploadAvatar,
      verifyBackupEmailCode,
      verifyLoginCode,
      verifyPrimaryEmailChange,
      verifyRegisterCode,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
