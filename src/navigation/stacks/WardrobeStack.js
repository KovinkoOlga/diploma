import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Routes } from "../routes";
import { useAppTheme } from "../../theme/ThemeProvider";
import WardrobeHomeScreen from "../../screens/wardrobe/WardrobeHomeScreen";
import WardrobeAllItemsScreen from "../../screens/wardrobe/WardrobeAllItemsScreen";
import WardrobeCategoryScreen from "../../screens/wardrobe/WardrobeCategoryScreen";
import WardrobeItemDetailsScreen from "../../screens/wardrobe/WardrobeItemDetailsScreen";
import WardrobeAddItemActionSheetScreen from "../../screens/wardrobe/WardrobeAddItemActionSheetScreen";
import WardrobeAddFromPhotoScreen from "../../screens/wardrobe/WardrobeAddFromPhotoScreen";
import WardrobeAddFromGalleryScreen from "../../screens/wardrobe/WardrobeAddFromGalleryScreen";
import WardrobeAddFromCatalogScreen from "../../screens/wardrobe/WardrobeAddFromCatalogScreen";
import WardrobeProcessingStubScreen from "../../screens/wardrobe/WardrobeProcessingStubScreen";
import WardrobeConfirmItemScreen from "../../screens/wardrobe/WardrobeConfirmItemScreen";
import WardrobeManageCatalogsScreen from "../../screens/wardrobe/WardrobeManageCatalogsScreen";
import WardrobeManageCategoriesScreen from "../../screens/wardrobe/WardrobeManageCategoriesScreen";
import WardrobeArchiveScreen from "../../screens/wardrobe/WardrobeArchiveScreen";

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
      <Stack.Screen name={Routes.WardrobeAllItems} component={WardrobeAllItemsScreen} options={{ title: "Все вещи" }} />
      <Stack.Screen name={Routes.WardrobeCategory} component={WardrobeCategoryScreen} options={{ title: "Категория" }} />
      <Stack.Screen name={Routes.WardrobeItemDetails} component={WardrobeItemDetailsScreen} options={{ title: "Вещь" }} />
      <Stack.Screen
        name={Routes.WardrobeAddItemMenu}
        component={WardrobeAddItemActionSheetScreen}
        options={{
          presentation: "transparentModal",
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <Stack.Screen name={Routes.WardrobeAddFromPhoto} component={WardrobeAddFromPhotoScreen} options={{ title: "Сфотографировать вещь" }} />
      <Stack.Screen name={Routes.WardrobeAddFromGallery} component={WardrobeAddFromGalleryScreen} options={{ title: "Загрузить из галереи" }} />
      <Stack.Screen name={Routes.WardrobeAddFromCatalog} component={WardrobeAddFromCatalogScreen} options={{ title: "Базовый каталог" }} />
      <Stack.Screen name={Routes.WardrobeProcessingStub} component={WardrobeProcessingStubScreen} options={{ title: "Обработка" }} />
      <Stack.Screen name={Routes.WardrobeConfirmItem} component={WardrobeConfirmItemScreen} options={{ title: "Подтверждение" }} />
      <Stack.Screen name={Routes.WardrobeManageCatalogs} component={WardrobeManageCatalogsScreen} options={{ title: "Каталоги" }} />
      <Stack.Screen name={Routes.WardrobeManageCategories} component={WardrobeManageCategoriesScreen} options={{ title: "Категории" }} />
      <Stack.Screen name={Routes.WardrobeArchive} component={WardrobeArchiveScreen} options={{ title: "Архив" }} />
    </Stack.Navigator>
  );
}
