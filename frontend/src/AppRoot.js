import React, { useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { enableScreens } from "react-native-screens";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useAppTheme } from "./theme/ThemeProvider";
import AuthScreen from "./screens/auth/AuthScreen";
import { AuthProvider, useAuth } from "./store/AuthStore";
import { WardrobeProvider } from "./store/WardrobeStore";
import RootNavigator from "./navigation/RootNavigator";

enableScreens();

function InnerApp() {
  const theme = useAppTheme();
  const { authenticated, bootstrapping } = useAuth();
  const barStyle = useMemo(() => (theme.isDark ? "light" : "dark"), [theme.isDark]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={barStyle} />
      <SafeAreaProvider>
        {authenticated ? (
          <WardrobeProvider>
            <RootNavigator />
          </WardrobeProvider>
        ) : bootstrapping ? null : (
          <AuthScreen />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function AppRoot() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
