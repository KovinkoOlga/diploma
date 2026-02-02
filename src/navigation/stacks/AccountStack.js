import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Routes } from "../routes";
import AccountHomeScreen from "../../screens/account/AccountHomeScreen";
import SettingsScreen from "../../screens/account/SettingsScreen";
import { useAppTheme } from "../../theme/ThemeProvider";

const Stack = createNativeStackNavigator();

export default function AccountStack() {
  const theme = useAppTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTitleStyle: {
          ...theme.typography.h3,
          color: theme.colors.text,
        },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Stack.Screen
        name={Routes.AccountHome}
        component={AccountHomeScreen}
        options={{ title: "Аккаунт" }}
      />
      <Stack.Screen name={Routes.Settings} component={SettingsScreen} options={{ title: "Настройки" }} />
    </Stack.Navigator>
  );
}
