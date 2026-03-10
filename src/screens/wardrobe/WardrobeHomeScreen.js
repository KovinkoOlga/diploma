import React, { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import Screen, { useScreenContentInsets } from "../../components/Screen";
import AppHeader from "../../components/AppHeader";
import ActionButton from "../../components/ActionButton";
import Chip from "../../components/Chip";
import WardrobeItemCard from "../../components/WardrobeItemCard";
import EmptyState from "../../components/EmptyState";
import { useAppTheme } from "../../theme/ThemeProvider";
import { categories } from "../../data/categories";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function WardrobeHomeScreen({ navigation }) {
  const { spacing, layout } = useAppTheme();
  const { bottom } = useScreenContentInsets(12);
  const { items } = useWardrobe();
  const [viewMode, setViewMode] = useState("grid");
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredItems = useMemo(() => {
    if (activeCategory === "all") return items;
    return items.filter((item) => item.categoryId === activeCategory);
  }, [activeCategory, items]);

  return (
    <Screen
      header={
        <AppHeader
          title="Шкаф"
          subtitle={`${items.length} вещей в коллекции`}
          right={<ActionButton icon="add-outline" compact variant="ghost" onPress={() => navigation.navigate(Routes.AddItem)} />}
        />
      }
    >
      <FlatList
        key={viewMode}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={viewMode === "grid" ? 2 : 1}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={viewMode === "grid" ? { gap: spacing.sm } : undefined}
        contentContainerStyle={{ paddingBottom: bottom, paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm }}
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
              <ActionButton
                label="Сетка"
                icon="grid-outline"
                variant={viewMode === "grid" ? "primary" : "secondary"}
                onPress={() => setViewMode("grid")}
                style={{ flex: 1 }}
                fullWidth
              />
              <ActionButton
                label="Список"
                icon="list-outline"
                variant={viewMode === "list" ? "primary" : "secondary"}
                onPress={() => setViewMode("list")}
                style={{ flex: 1 }}
                fullWidth
              />
            </View>
            <FlatList
              horizontal
              data={[{ id: "all", title: "Все" }, ...categories]}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: spacing.sm }}
              renderItem={({ item }) => (
                <Chip label={item.title} selected={activeCategory === item.id} onPress={() => setActiveCategory(item.id)} />
              )}
            />
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <WardrobeItemCard
              item={item}
              variant={viewMode}
              onPress={() => navigation.navigate(Routes.ItemDetails, { itemId: item.id })}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState
            icon="shirt-outline"
            title="Шкаф пока пуст"
            subtitle="Добавьте первую вещь, чтобы начать собирать коллекцию."
            actionLabel="Новая вещь"
            onAction={() => navigation.navigate(Routes.AddItem)}
          />
        }
      />
    </Screen>
  );
}
