import React, { useLayoutEffect, useMemo } from "react";
import { FlatList, View } from "react-native";
import Screen from "../../components/Screen";
import EmptyState from "../../components/EmptyState";
import ItemCard from "../../components/ItemCard";
import FAB from "../../components/FAB";
import { useAppTheme } from "../../theme/ThemeProvider";
import { getCategoryById } from "../../data/categories";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function CategoryScreen({ navigation, route }) {
  const { spacing } = useAppTheme();
  const { items } = useWardrobe();
  const categoryId = route.params?.categoryId;
  const category = getCategoryById(categoryId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: category?.title ?? "Категория" });
  }, [navigation, category?.title]);

  const filtered = useMemo(() => items.filter((it) => it.categoryId === categoryId), [items, categoryId]);

  return (
    <Screen>
      <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon="pricetag-outline"
            title="Пока пусто"
            subtitle="Добавьте вещь в эту категорию — она появится здесь."
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: 160 }}
            renderItem={({ item }) => (
              <ItemCard item={item} onPress={() => navigation.navigate(Routes.ItemDetails, { itemId: item.id })} />
            )}
          />
        )}
      </View>

      <FAB onPress={() => navigation.navigate(Routes.AddItem, { presetCategoryId: categoryId })} />
    </Screen>
  );
}

