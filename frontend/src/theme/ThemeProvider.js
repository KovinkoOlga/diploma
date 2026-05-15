import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { createTheme } from "./theme";

const ThemeContext = createContext(createTheme("light"));

export function ThemeProvider({ children }) {
  const scheme = useColorScheme() ?? "light";
  const theme = useMemo(() => createTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

