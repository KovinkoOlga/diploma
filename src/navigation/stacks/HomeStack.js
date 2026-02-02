import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Routes } from "../routes";
import HomeScreen from "../../screens/home/HomeScreen";
import { useAppTheme } from "../../theme/ThemeProvider";

const Stack = createNativeStackNavigator();

export default function HomeStack() {
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
      <Stack.Screen name={Routes.Home} component={HomeScreen} options={{ title: "Главная" }} />
    </Stack.Navigator>
  );
}
