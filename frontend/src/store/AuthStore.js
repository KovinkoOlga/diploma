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

  const clearSession = useCallback(async () => {
    await clearStoredTokens();
    setCurrentUser(null);
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
        if (alive) setCurrentUser(session.user);
      } catch (error) {
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

  const login = useCallback(async (email, password) => {
    setAuthError("");
    const session = await authApi.login({ email, password });
    await saveTokens(session);
    setCurrentUser(session.user);
    return session.user;
  }, []);

  const register = useCallback(async (email, password) => {
    setAuthError("");
    const session = await authApi.register({ email, password });
    await saveTokens(session);
    setCurrentUser(session.user);
    return session.user;
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

  const value = useMemo(
    () => ({
      currentUser,
      authenticated: Boolean(currentUser),
      bootstrapping,
      authError,
      setAuthError,
      login,
      register,
      logout,
      updateProfile,
      clearSession,
    }),
    [authError, bootstrapping, clearSession, currentUser, login, logout, register, updateProfile]
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

