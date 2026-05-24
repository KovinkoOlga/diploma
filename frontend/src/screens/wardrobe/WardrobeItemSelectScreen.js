import React, { useLayoutEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import Screen, { useScreenContentInsets } from "../../components/Screen";
import SearchBar from "../../components/SearchBar";
import EmptyState from "../../components/EmptyState";
import WardrobeItemCard from "../../components/WardrobeItemCard";
import { markManualItemWear } from "../../api/wearLogs";
import { Routes } from "../../navigation/routes";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAppTheme } from "../../theme/ThemeProvider";

function buildOutfitDraftTitle(targetDate) {
  const date = new Date(targetDate);
  try {
    const title = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long" }).format(date);
    return `Сочетание ${title}`;
  } catch {
    return `Сочетание ${targetDate}`;
  }
}

function askToSaveOutfit() {
  return new Promise((resolve) => {
    Alert.alert("Сохранить как образ?", "Хотите сохранить выбранные вещи как новый образ?", [
      { text: "Отмена", style: "cancel", onPress: () => resolve("cancel") },
      { text: "Только отметить", onPress: () => resolve("keep") },
      { text: "Сохранить как образ", onPress: () => resolve("save") },
    ]);
  });
}

function navigateAfterFinish(navigation, returnTo, targetDate) {
  const parent = navigation.getParent();
  if (navigation.canGoBack()) {
    navigation.goBack();
  }
  if (!parent) {
    return;
  }

  if (returnTo === "calendar") {
    parent.navigate("HomeTab", {
      screen: Routes.OutfitCalendar,
      params: { selectedDate: targetDate, refreshKey: Date.now() },
    });
    return;
  }

  if (returnTo === "weekly") {
    parent.navigate("HomeTab", {
      screen: Routes.WeeklyCheckIn,
      params: { refreshKey: Date.now() },
    });
    return;
  }

  parent.navigate("HomeTab", {
    screen: Routes.Home,
    params: { refreshKey: Date.now() },
  });
}

export default function WardrobeItemSelectScreen({ navigation, route }) {
  const { items, categories, actions } = useWardrobe();
  const { colors, spacing, typography } = useAppTheme();
  const { bottom } = useScreenContentInsets(32);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(route.params?.selectedItemIds ?? []);
  const [saving, setSaving] = useState(false);

  const targetDate = route.params?.targetDate;
  const returnTo = route.params?.returnTo ?? "home";
  const source = route.params?.source ?? "manual_outfit";
  const categoriesById = useMemo(() => Object.fromEntries(categories.map((entry) => [entry.id, entry])), [categories]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => !item.isArchived && item.status !== "archived")
      .filter((item) => {
        if (!normalizedQuery) return true;
        const title = String(item.title ?? "").toLowerCase();
        const subtitle = String(item.subcategory ?? "").toLowerCase();
        return title.includes(normalizedQuery) || subtitle.includes(normalizedQuery);
      });
  }, [items, query]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Выбор вещей",
      headerLeft: () => (
        <Pressable onPress={() => navigateAfterFinish(navigation, returnTo, targetDate)} style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}>
          <Text style={[typography.body, { color: colors.text }]}>Отмена</Text>
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          disabled={!selectedIds.length || saving}
          onPress={async () => {
            if (!selectedIds.length || !targetDate) return;
            setSaving(true);
            try {
              await markManualItemWear({
                item_ids: selectedIds,
                worn_date: targetDate,
                source,
              });
              await actions.refreshItems();

              if (selectedIds.length >= 2) {
                const action = await askToSaveOutfit();
                if (action === "save") {
                  await actions.upsertOutfit({
                    title: buildOutfitDraftTitle(targetDate),
                    itemIds: selectedIds,
                    tags: [],
                    season: [],
                    collectionIds: [],
                    description: "",
                  });
                  await actions.refreshOutfits();
                }
              }

              navigateAfterFinish(navigation, returnTo, targetDate);
            } catch (error) {
              Alert.alert("Не удалось сохранить", error.message || "Попробуйте ещё раз");
            } finally {
              setSaving(false);
            }
          }}
          style={({ pressed }) => [{ opacity: !selectedIds.length || saving ? 0.4 : pressed ? 0.65 : 1 }]}
        >
          <Text style={[typography.body, { color: colors.text }]}>
            {saving ? "Сохраняем..." : "Выбрать"}
          </Text>
        </Pressable>
      ),
    });
  }, [actions, colors.text, navigation, returnTo, saving, selectedIds, source, targetDate, typography.body]);

  function toggleItem(itemId) {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((entry) => entry !== itemId) : [...current, itemId]
    );
  }

  return (
    <Screen style={{ flex: 1 }}>
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: bottom,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery("")} placeholder="Найти вещь" />
            <Text style={[typography.caption, { color: colors.secondaryText, marginTop: spacing.sm }]}>
              {targetDate ? `Дата: ${targetDate}` : "Выберите одну или несколько вещей"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <WardrobeItemCard
              item={item}
              category={categoriesById[item.categoryId]}
              selectionMode
              selected={selectedIds.includes(item.id)}
              onPress={() => toggleItem(item.id)}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <EmptyState
            icon="shirt-outline"
            title="Нет вещей"
            subtitle="Добавьте вещи, чтобы отмечать их в календаре и статистике."
          />
        }
      />
    </Screen>
  );
}
