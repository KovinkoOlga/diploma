import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Routes } from "../routes";
import AccountHomeScreen from "../../screens/account/AccountHomeScreen";
import SettingsScreen from "../../screens/account/SettingsScreen";
import ProfileSettingsScreen from "../../screens/account/ProfileSettingsScreen";
import { useAppTheme } from "../../theme/ThemeProvider";

const Stack = createNativeStackNavigator();

export default function AccountStack() {
  const theme = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTitleStyle: { ...theme.typography.headerTitle, color: theme.colors.text },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        headerTitleAlign: "center",
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name={Routes.AccountHome} component={AccountHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name={Routes.Settings} component={SettingsScreen} options={{ title: "Настройки" }} />
      <Stack.Screen
        name={Routes.ProfileSettings}
        component={ProfileSettingsScreen}
        options={{
          title: "Личные данные",
          headerBackButtonDisplayMode: "minimal",
          headerTitleStyle: { ...theme.typography.h2, color: theme.colors.text },
        }}
      />
    </Stack.Navigator>
  );
}
