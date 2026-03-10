import React, { useLayoutEffect, useMemo } from "react";
import { FlatList, View } from "react-native";
import Screen, { useScreenContentInsets } from "../../components/Screen";
import WardrobeItemCard from "../../components/WardrobeItemCard";
import EmptyState from "../../components/EmptyState";
import { useAppTheme } from "../../theme/ThemeProvider";
import { getCategoryById } from "../../data/categories";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function CategoryScreen({ navigation, route }) {
  const { spacing, layout } = useAppTheme();
  const { bottom } = useScreenContentInsets(12);
  const { items } = useWardrobe();
  const category = getCategoryById(route.params?.categoryId);
  const filteredItems = useMemo(
    () => items.filter((item) => item.categoryId === route.params?.categoryId),
    [items, route.params?.categoryId]
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: category?.title ?? "Категория" });
  }, [category?.title, navigation]);

  return (
    <Screen>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{ paddingBottom: bottom, paddingHorizontal: layout.screenPadding, paddingTop: spacing.md }}
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <WardrobeItemCard item={item} onPress={() => navigation.navigate(Routes.ItemDetails, { itemId: item.id })} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState icon="albums-outline" title="В этой категории пусто" subtitle="Добавьте вещь или выберите другую категорию." />
        }
      />
    </Screen>
  );
}
