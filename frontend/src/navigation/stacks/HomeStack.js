import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Routes } from "../routes";
import HomeScreen from "../../screens/home/HomeScreen";
import OutfitCalendarScreen from "../../screens/home/OutfitCalendarScreen";
import WeeklyCheckInScreen from "../../screens/home/WeeklyCheckInScreen";
import { useAppTheme } from "../../theme/ThemeProvider";

const Stack = createNativeStackNavigator();

export default function HomeStack() {
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
      <Stack.Screen name={Routes.Home} component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name={Routes.OutfitCalendar} component={OutfitCalendarScreen} options={{ title: "Календарь образов" }} />
      <Stack.Screen name={Routes.WeeklyCheckIn} component={WeeklyCheckInScreen} options={{ title: "Отметить неделю" }} />
    </Stack.Navigator>
  );
}
