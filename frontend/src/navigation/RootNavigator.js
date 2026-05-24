import React, { useMemo } from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { useAppTheme } from "../theme/ThemeProvider";
import { navigationRef } from "./navigationRef";
import TabNavigator from "./TabNavigator";

export default function RootNavigator() {
  const theme = useAppTheme();

  const navTheme = useMemo(() => {
    const base = theme.isDark ? DarkTheme : DefaultTheme;

    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.colors.background,
        card: theme.colors.surface,
        border: theme.colors.border,
        text: theme.colors.text,
        primary: theme.colors.accent,
      },
    };
  }, [theme]);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <TabNavigator />
    </NavigationContainer>
  );
}
