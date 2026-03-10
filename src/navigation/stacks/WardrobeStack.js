import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Routes } from "../routes";
import WardrobeHomeScreen from "../../screens/wardrobe/WardrobeHomeScreen";
import CategoryScreen from "../../screens/wardrobe/CategoryScreen";
import ItemDetailsScreen from "../../screens/wardrobe/ItemDetailsScreen";
import AddItemScreen from "../../screens/wardrobe/AddItemScreen";
import { useAppTheme } from "../../theme/ThemeProvider";

const Stack = createNativeStackNavigator();

export default function WardrobeStack() {
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
      <Stack.Screen name={Routes.WardrobeHome} component={WardrobeHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name={Routes.Category} component={CategoryScreen} options={{ title: "Категория" }} />
      <Stack.Screen name={Routes.ItemDetails} component={ItemDetailsScreen} options={{ title: "Вещь" }} />
      <Stack.Screen name={Routes.AddItem} component={AddItemScreen} options={{ title: "Новая вещь" }} />
    </Stack.Navigator>
  );
}
