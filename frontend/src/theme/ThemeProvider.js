import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createTheme } from "./theme";

const THEME_MODE_KEY = "settings_theme_mode";
const DEFAULT_THEME_MODE = "system";

const ThemeContext = createContext({
  ...createTheme("light"),
  resolvedScheme: "light",
  themeMode: DEFAULT_THEME_MODE,
  setThemeMode: async () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme() === "dark" ? "dark" : "light";
  const [themeMode, setThemeModeState] = useState(DEFAULT_THEME_MODE);

  useEffect(() => {
    let alive = true;

    async function loadThemeMode() {
      try {
        const storedThemeMode = await SecureStore.getItemAsync(THEME_MODE_KEY);
        if (!alive || !storedThemeMode || !["system", "light", "dark"].includes(storedThemeMode)) {
          return;
        }
        setThemeModeState(storedThemeMode);
      } catch {
        return;
      }
    }

    loadThemeMode();
    return () => {
      alive = false;
    };
  }, []);

  const setThemeMode = useCallback(async (nextMode) => {
    const resolvedMode = ["system", "light", "dark"].includes(nextMode) ? nextMode : DEFAULT_THEME_MODE;
    setThemeModeState(resolvedMode);

    try {
      if (resolvedMode === DEFAULT_THEME_MODE) {
        await SecureStore.deleteItemAsync(THEME_MODE_KEY);
        return;
      }

      await SecureStore.setItemAsync(THEME_MODE_KEY, resolvedMode);
    } catch {
      return;
    }
  }, []);

  const resolvedScheme = themeMode === DEFAULT_THEME_MODE ? systemScheme : themeMode;
  const theme = useMemo(
    () => ({
      ...createTheme(resolvedScheme),
      resolvedScheme,
      themeMode,
      setThemeMode,
    }),
    [resolvedScheme, setThemeMode, themeMode]
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
