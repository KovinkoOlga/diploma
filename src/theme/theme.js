import { lightColors, darkColors } from "./colors";
import { typography } from "./typography";

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const shadows = {
  card: {},
  tabBar: {},
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
    layout: {
      screenPadding: 16,
      cardGap: 14,
      sectionGap: 20,
      tabBarBaseHeight: 56,
    },
  };
}
