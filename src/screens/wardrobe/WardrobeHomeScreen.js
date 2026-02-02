import React, { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import Screen from "../../components/Screen";
import SectionHeader from "../../components/SectionHeader";
import SegmentedControl from "../../components/SegmentedControl";
import CategoryTile from "../../components/CategoryTile";
import ItemCard from "../../components/ItemCard";
import EmptyState from "../../components/EmptyState";
import FAB from "../../components/FAB";
import { useAppTheme } from "../../theme/ThemeProvider";
import { categories } from "../../data/categories";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function WardrobeHomeScreen({ navigation }) {
  const { spacing } = useAppTheme();
  const { items } = useWardrobe();

  const [mode, setMode] = useState("categories"); // categories | all

  const counts = useMemo(() => {
    const map = {};
    for (const c of categories) map[c.id] = 0;
    for (const it of items) map[it.categoryId] = (map[it.categoryId] ?? 0) + 1;
    return map;
  }, [items]);

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { label: "Категории", value: "categories" },
            { label: "Все вещи", value: "all" },
          ]}
        />
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        {mode === "categories" ? (
          <>
            <SectionHeader title="Категории" />
            <FlatList
              data={categories}
              keyExtractor={(c) => c.id}
              numColumns={2}
              columnWrapperStyle={{ gap: spacing.sm }}
              contentContainerStyle={{ gap: spacing.sm, paddingBottom: 160 }}
              renderItem={({ item }) => (
                <View style={{ flex: 1 }}>
                  <CategoryTile
                    title={item.title}
                    icon={item.icon}
                    tone={item.tone}
                    count={counts[item.id] ?? 0}
                    onPress={() => navigation.navigate(Routes.Category, { categoryId: item.id })}
                  />
                </View>
              )}
            />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            icon="shirt-outline"
            title="Пока нет вещей"
            subtitle="Добавьте первую вещь — она появится в списке и в категориях."
          />
        ) : (
          <>
            <SectionHeader title={`Все вещи · ${items.length}`} />
            <FlatList
              data={items}
              keyExtractor={(it) => it.id}
              contentContainerStyle={{ gap: spacing.sm, paddingBottom: 160 }}
              renderItem={({ item }) => (
                <ItemCard
                  item={item}
                  onPress={() => navigation.navigate(Routes.ItemDetails, { itemId: item.id })}
                />
              )}
            />
          </>
        )}
      </View>

      <FAB onPress={() => navigation.navigate(Routes.AddItem)} />
    </Screen>
  );
}

