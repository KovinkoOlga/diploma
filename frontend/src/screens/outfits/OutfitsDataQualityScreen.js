import React, { useLayoutEffect, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import Screen, { useScreenContentInsets } from "../../components/Screen";
import SearchBar from "../../components/SearchBar";
import ActionButton from "../../components/ActionButton";
import EmptyState from "../../components/EmptyState";
import OutfitCard from "../../components/OutfitCard";
import OutfitFiltersSheet from "../../components/OutfitFiltersSheet";
import OutfitSortSheet from "../../components/OutfitSortSheet";
import { Routes } from "../../navigation/routes";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAppTheme } from "../../theme/ThemeProvider";
import {
  ALL_OUTFITS_COLLECTION_ID,
  applyOutfitFilters,
  countOutfitFilters,
  createEmptyOutfitFilters,
  getOutfitFilterOptions,
  matchesOutfitSearch,
  sortOutfits,
} from "../../utils/outfits";

export default function OutfitsDataQualityScreen({ navigation, route }) {
  const { spacing, layout, colors, typography } = useAppTheme();
  const { bottom } = useScreenContentInsets(32);
  const { outfits, items, categories, catalogs, colorOptions, seasonOptions, styleOptions, statusOptions, outfitCollections } = useWardrobe();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(createEmptyOutfitFilters());
  const [sortBy, setSortBy] = useState("recent");
  const [filterVisible, setFilterVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const selectedIds = route.params?.outfitIds ?? [];
  const periodLabel = route.params?.periodLabel ?? "";

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Качество данных" });
  }, [navigation]);

  const scopedOutfits = useMemo(() => {
    const ids = new Set(selectedIds);
    return outfits.filter((outfit) => ids.has(outfit.id));
  }, [outfits, selectedIds]);
  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const categoriesById = useMemo(() => Object.fromEntries(categories.map((entry) => [entry.id, entry])), [categories]);
  const catalogsById = useMemo(() => Object.fromEntries(catalogs.map((entry) => [entry.id, entry])), [catalogs]);
  const filterOptions = useMemo(
    () =>
      getOutfitFilterOptions(scopedOutfits, {
        itemById,
        categories,
        catalogs,
        colorOptions,
        seasonOptions,
        styleOptions,
        statusOptions,
        outfitCollections,
      }),
    [catalogs, categories, colorOptions, itemById, outfitCollections, scopedOutfits, seasonOptions, statusOptions, styleOptions]
  );
  const visibleOutfits = useMemo(() => {
    const filtered = applyOutfitFilters(scopedOutfits, filters, {
      activeCollectionId: ALL_OUTFITS_COLLECTION_ID,
      itemById,
    }).filter((outfit) =>
      matchesOutfitSearch(outfit, query, {
        itemById,
        categoriesById,
        catalogsById,
      })
    );

    return sortOutfits(filtered, sortBy);
  }, [catalogsById, categoriesById, filters, itemById, query, scopedOutfits, sortBy]);
  const activeFilterCount = useMemo(
    () =>
      countOutfitFilters(filters, {
        includeCollection: true,
        includeWithoutCollection: true,
      }),
    [filters]
  );

  return (
    <Screen style={{ flex: 1 }}>
      <FlatList
        data={visibleOutfits}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.md,
          paddingBottom: bottom,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery("")} placeholder="Найти образ" />
              </View>
              <ActionButton
                icon="options-outline"
                compact
                variant="secondary"
                label={activeFilterCount ? String(activeFilterCount) : undefined}
                onPress={() => setFilterVisible(true)}
              />
              <ActionButton icon="swap-vertical-outline" compact variant="secondary" onPress={() => setSortVisible(true)} />
            </View>

            <Text style={[typography.sectionTitle, { color: colors.text, marginTop: spacing.lg }]}>Образы в статистике</Text>
            <Text style={[typography.caption, { color: colors.secondaryText, marginTop: spacing.xs }]}>
              {periodLabel ? `${visibleOutfits.length} образов · ${periodLabel}` : `${visibleOutfits.length} образов`}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <OutfitCard
              outfit={item}
              items={(item.itemIds ?? []).map((itemId) => itemById[itemId]).filter(Boolean)}
              onPress={() => navigation.navigate(Routes.OutfitDetails, { outfitId: item.id })}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <EmptyState
            icon="bookmark-outline"
            title="Нет образов для этого периода"
            subtitle="В выбранной статистике сейчас нет образов, попадающих в расчёт качества данных."
          />
        }
      />

      <OutfitFiltersSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={filters}
        onApply={setFilters}
        options={filterOptions}
        allowCollectionFilter
        showWithoutCollection
      />
      <OutfitSortSheet visible={sortVisible} onClose={() => setSortVisible(false)} sortBy={sortBy} onChangeSort={setSortBy} />
    </Screen>
  );
}
