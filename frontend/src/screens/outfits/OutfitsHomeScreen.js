import React, { useMemo, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import Screen, { useScreenContentInsets } from "../../components/Screen";
import AppHeader from "../../components/AppHeader";
import ActionButton from "../../components/ActionButton";
import Chip from "../../components/Chip";
import OutfitCard from "../../components/OutfitCard";
import EmptyState from "../../components/EmptyState";
import SearchBar from "../../components/SearchBar";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function OutfitsHomeScreen({ navigation }) {
  const { spacing, layout } = useAppTheme();
  const { bottom } = useScreenContentInsets(12);
  const { outfits, items } = useWardrobe();
  const [activeTag, setActiveTag] = useState("all");
  const [activeSeason, setActiveSeason] = useState("all");
  const [query, setQuery] = useState("");

  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const allTags = useMemo(() => ["all", ...new Set(outfits.flatMap((outfit) => outfit.tags ?? []))], [outfits]);
  const allSeasons = useMemo(() => ["all", ...new Set(outfits.flatMap((outfit) => outfit.season ?? []))], [outfits]);

  const filteredOutfits = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return outfits.filter((outfit) => {
      if (activeTag !== "all" && !(outfit.tags ?? []).includes(activeTag)) return false;
      if (activeSeason !== "all" && !(outfit.season ?? []).includes(activeSeason)) return false;
      if (!normalized) return true;
      return String(outfit.title ?? "").toLowerCase().includes(normalized);
    });
  }, [activeSeason, activeTag, outfits, query]);

  return (
    <Screen
      header={
        <AppHeader
          title="Образы"
          subtitle={`${outfits.length} образов`}
          right={<ActionButton icon="add-outline" compact variant="ghost" onPress={() => navigation.navigate(Routes.OutfitEditor)} />}
        />
      }
    >
      <FlatList
        data={filteredOutfits}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{ paddingBottom: bottom, paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm }}
        ListHeaderComponent={
          <View>
            <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery("")} placeholder="Поиск по названию" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: spacing.sm }}>
              {allTags.map((tag) => (
                <Chip key={tag} label={tag === "all" ? "Все стили" : tag} selected={activeTag === tag} onPress={() => setActiveTag(tag)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: spacing.sm }}>
              {allSeasons.map((season) => (
                <Chip key={season} label={season === "all" ? "Все сезоны" : season} selected={activeSeason === season} onPress={() => setActiveSeason(season)} />
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <OutfitCard
              outfit={item}
              items={item.itemIds.map((id) => itemById[id]).filter(Boolean)}
              onPress={() => navigation.navigate(Routes.OutfitDetails, { outfitId: item.id })}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState
            icon="bookmark-outline"
            title="Пока нет образов"
            subtitle="Соберите первый образ из вещей вашего шкафа."
            actionLabel="Создать образ"
            onAction={() => navigation.navigate(Routes.OutfitEditor)}
          />
        }
      />
    </Screen>
  );
}
