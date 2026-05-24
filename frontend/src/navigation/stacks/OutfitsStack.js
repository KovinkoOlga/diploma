import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Routes } from "../routes";
import OutfitsHomeScreen from "../../screens/outfits/OutfitsHomeScreen";
import OutfitDetailsScreen from "../../screens/outfits/OutfitDetailsScreen";
import OutfitEditorScreen from "../../screens/outfits/OutfitEditorScreen";
import OutfitCoverEditorScreen from "../../screens/outfits/OutfitCoverEditorScreen";
import OutfitsDictionariesScreen from "../../screens/outfits/OutfitsDictionariesScreen";
import AddOutfitsToCollectionScreen from "../../screens/outfits/AddOutfitsToCollectionScreen";
import OutfitSelectScreen from "../../screens/outfits/OutfitSelectScreen";
import { useAppTheme } from "../../theme/ThemeProvider";

const Stack = createNativeStackNavigator();

export default function OutfitsStack() {
  const theme = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTitleStyle: { ...theme.typography.headerTitle, color: theme.colors.text },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        headerBackButtonDisplayMode: "minimal",
        headerTitleAlign: "center",
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name={Routes.OutfitsHome} component={OutfitsHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name={Routes.OutfitDetails} component={OutfitDetailsScreen} options={{ title: "Образ" }} />
      <Stack.Screen name={Routes.OutfitEditor} component={OutfitEditorScreen} options={{ title: "Редактор образа" }} />
      <Stack.Screen name={Routes.OutfitCoverEditor} component={OutfitCoverEditorScreen} options={{ title: "Обложка" }} />
      <Stack.Screen name={Routes.OutfitsDictionaries} component={OutfitsDictionariesScreen} options={{ title: "Справочники" }} />
      <Stack.Screen
        name={Routes.OutfitCollectionAddExisting}
        component={AddOutfitsToCollectionScreen}
        options={{ title: "Добавить существующие" }}
      />
      <Stack.Screen name={Routes.OutfitSelect} component={OutfitSelectScreen} options={{ title: "Выбор образа" }} />
    </Stack.Navigator>
  );
}
