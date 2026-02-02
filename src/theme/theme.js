import { Platform } from "react-native";
import { lightColors, darkColors } from "./colors";
import { typography } from "./typography";

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 36,
};

// Softer, "handmade" rounding.
export const radius = {
  sm: 14,
  md: 18,
  lg: 22,
  pill: 999,
};

// Very gentle shadows: paper lifted slightly by morning light (avoid aggressive depth).
export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: "#2E2A27",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 1 },
    default: {},
  }),
  tabBar: Platform.select({
    ios: {
      shadowColor: "#2E2A27",
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 3 },
    default: {},
  }),
};

export function createTheme(colorScheme = "light") {
  const isDark = colorScheme === "dark";
  const colors = isDark ? darkColors : lightColors;

  return {
    isDark,
    colors,
    spacing,
    typography,
    radius,
    shadows,
  };
}
