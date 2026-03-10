import React, { useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { enableScreens } from "react-native-screens";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useAppTheme } from "./theme/ThemeProvider";
import { WardrobeProvider } from "./store/WardrobeStore";
import RootNavigator from "./navigation/RootNavigator";

enableScreens();

function InnerApp() {
  const theme = useAppTheme();
  const barStyle = useMemo(() => (theme.isDark ? "light" : "dark"), [theme.isDark]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={barStyle} />
      <SafeAreaProvider>
        <WardrobeProvider>
          <RootNavigator />
        </WardrobeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function AppRoot() {
  return (
    <ThemeProvider>
      <InnerApp />
    </ThemeProvider>
  );
}
