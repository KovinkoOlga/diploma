import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Routes } from "../routes";
import OutfitsHomeScreen from "../../screens/outfits/OutfitsHomeScreen";
import OutfitDetailsScreen from "../../screens/outfits/OutfitDetailsScreen";
import OutfitEditorScreen from "../../screens/outfits/OutfitEditorScreen";
import { useAppTheme } from "../../theme/ThemeProvider";

const Stack = createNativeStackNavigator();

export default function OutfitsStack() {
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
        name={Routes.OutfitsHome}
        component={OutfitsHomeScreen}
        options={{ title: "Образы" }}
      />
      <Stack.Screen
        name={Routes.OutfitDetails}
        component={OutfitDetailsScreen}
        options={{ title: "Образ" }}
      />
      <Stack.Screen
        name={Routes.OutfitEditor}
        component={OutfitEditorScreen}
        options={{ title: "Редактор" }}
      />
    </Stack.Navigator>
  );
}
