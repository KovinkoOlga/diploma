import React, { useEffect, useMemo } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { enableScreens } from "react-native-screens";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useAppTheme } from "./theme/ThemeProvider";
import AuthScreen from "./screens/auth/AuthScreen";
import BackupEmailOfferScreen from "./screens/auth/BackupEmailOfferScreen";
import { AuthProvider, useAuth } from "./store/AuthStore";
import { WardrobeProvider } from "./store/WardrobeStore";
import RootNavigator from "./navigation/RootNavigator";
import { registerNotificationResponseHandler, syncWeeklyCalendarReminder } from "./services/notifications";

enableScreens();

function InnerApp() {
  const theme = useAppTheme();
  const { authenticated, bootstrapping, pendingBackupOnboarding } = useAuth();
  const barStyle = useMemo(() => (theme.isDark ? "light" : "dark"), [theme.isDark]);

  useEffect(() => {
    syncWeeklyCalendarReminder().catch(() => {});
  }, []);

  useEffect(() => {
    if (!authenticated) return undefined;

    let cleanup = null;
    registerNotificationResponseHandler()
      .then((dispose) => {
        cleanup = dispose;
      })
      .catch(() => {});

    return () => {
      if (typeof cleanup === "function") {
        cleanup();
      }
    };
  }, [authenticated]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={barStyle} />
      <SafeAreaProvider>
        {authenticated ? (
          pendingBackupOnboarding ? (
            <BackupEmailOfferScreen />
          ) : (
            <WardrobeProvider>
              <RootNavigator />
            </WardrobeProvider>
          )
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
