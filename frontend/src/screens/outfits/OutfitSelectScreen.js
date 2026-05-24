import React, { useLayoutEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import Screen, { useScreenContentInsets } from "../../components/Screen";
import SearchBar from "../../components/SearchBar";
import EmptyState from "../../components/EmptyState";
import OutfitCard from "../../components/OutfitCard";
import { assignOutfitToDay } from "../../api/calendar";
import { Routes } from "../../navigation/routes";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAppTheme } from "../../theme/ThemeProvider";

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

export default function OutfitSelectScreen({ navigation, route }) {
  const { outfits, items } = useWardrobe();
  const { colors, spacing, typography } = useAppTheme();
  const { bottom } = useScreenContentInsets(32);
  const [query, setQuery] = useState("");
  const [selectedOutfitId, setSelectedOutfitId] = useState(route.params?.selectedOutfitId ?? "");
  const [saving, setSaving] = useState(false);

  const targetDate = route.params?.targetDate;
  const returnTo = route.params?.returnTo ?? "home";
  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const visibleOutfits = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return outfits;
    return outfits.filter((outfit) => {
      const title = String(outfit.title ?? "").toLowerCase();
      const seasons = (outfit.season ?? []).join(" ").toLowerCase();
      const tags = (outfit.tags ?? []).join(" ").toLowerCase();
      return title.includes(normalizedQuery) || seasons.includes(normalizedQuery) || tags.includes(normalizedQuery);
    });
  }, [outfits, query]);
  const selectedOutfit = useMemo(
    () => outfits.find((outfit) => outfit.id === selectedOutfitId) ?? null,
    [outfits, selectedOutfitId]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Выбор образа",
      headerLeft: () => (
        <Pressable onPress={() => navigateAfterFinish(navigation, returnTo, targetDate)} style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}>
          <Text style={[typography.body, { color: colors.text }]}>Отмена</Text>
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          disabled={!selectedOutfitId || saving}
          onPress={async () => {
            if (!selectedOutfit || !targetDate) return;
            setSaving(true);
            try {
              await assignOutfitToDay({
                date: targetDate,
                outfit_id: selectedOutfit.id,
                weather_snapshot_json: null,
              });
              navigateAfterFinish(navigation, returnTo, targetDate);
            } catch (error) {
              Alert.alert("Не удалось сохранить", error.message || "Попробуйте ещё раз");
            } finally {
              setSaving(false);
            }
          }}
          style={({ pressed }) => [{ opacity: !selectedOutfitId || saving ? 0.4 : pressed ? 0.65 : 1 }]}
        >
          <Text style={[typography.body, { color: colors.text }]}>
            {saving ? "Сохраняем..." : "Выбрать"}
          </Text>
        </Pressable>
      ),
    });
  }, [colors.text, navigation, returnTo, saving, selectedOutfit, selectedOutfitId, targetDate, typography.body]);

  return (
    <Screen style={{ flex: 1 }}>
      <FlatList
        data={visibleOutfits}
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
            <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery("")} placeholder="Найти образ" />
            <Text style={[typography.caption, { color: colors.secondaryText, marginTop: spacing.sm }]}>
              {targetDate ? `Дата: ${targetDate}` : "Выберите один образ"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <OutfitCard
              outfit={item}
              items={(item.itemIds ?? []).map((itemId) => itemById[itemId]).filter(Boolean)}
              selected={item.id === selectedOutfitId}
              onPress={() => setSelectedOutfitId(item.id)}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <EmptyState
            icon="bookmark-outline"
            title="Нет образов"
            subtitle="Добавьте образы, чтобы назначать их на даты календаря."
          />
        }
      />
    </Screen>
  );
}
