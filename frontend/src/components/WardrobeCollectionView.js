import React, { useMemo, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import { Routes } from "../navigation/routes";
import {
  applyWardrobeFilters,
  createEmptyWardrobeFilters,
  getOutfitCountMap,
  getWardrobeFilterOptions,
  matchesWardrobeSearch,
  sortWardrobeItems,
} from "../utils/wardrobe";
import Screen, { useScreenContentInsets } from "./Screen";
import SearchBar from "./SearchBar";
import ActionButton from "./ActionButton";
import WardrobeItemCard from "./WardrobeItemCard";
import EmptyState from "./EmptyState";
import FAB from "./FAB";
import WardrobeFiltersSheet from "./WardrobeFiltersSheet";
import WardrobeSortSheet from "./WardrobeSortSheet";
import SheetModal from "./SheetModal";
import Chip from "./Chip";

export default function WardrobeCollectionView({
  navigation,
  items,
  catalogs,
  categories,
  colorOptions,
  seasonOptions = [],
  styleOptions = [],
  statusOptions = [],
  outfits,
  actions,
  title,
  subtitle,
  emptyStateTitle,
  emptyStateSubtitle,
  fixedFilters = {},
  initialSelectionMode = false,
  allowCatalogFilter = true,
  allowCategoryFilter = true,
  showFab = true,
  archiveMode = false,
  initialQuery = "",
  initialFilters,
  initialSortBy = "recent",
}) {
  const { spacing, layout, colors, typography, radius } = useAppTheme();
  const { bottom } = useScreenContentInsets(86);
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState(initialFilters ?? createEmptyWardrobeFilters());
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [selectionMode, setSelectionMode] = useState(initialSelectionMode);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [bulkMode, setBulkMode] = useState("");
  const [bulkValue, setBulkValue] = useState("");

  const outfitCountMap = useMemo(() => getOutfitCountMap(outfits), [outfits]);
  const scopedItems = useMemo(
    () => applyWardrobeFilters(items, fixedFilters, outfitCountMap),
    [fixedFilters, items, outfitCountMap]
  );
  const filterOptions = useMemo(
    () => getWardrobeFilterOptions(scopedItems, colorOptions, { seasonOptions, styleOptions, statusOptions }),
    [colorOptions, scopedItems, seasonOptions, statusOptions, styleOptions]
  );
  const mergedItems = useMemo(() => {
    const filteredByControls = applyWardrobeFilters(scopedItems, filters, outfitCountMap).filter((item) =>
      matchesWardrobeSearch(item, query, categories, catalogs)
    );
    const showArchived = archiveMode || (filters.status ?? []).includes("archived");
    const visibleItems = showArchived ? filteredByControls : filteredByControls.filter((item) => !item.isArchived);

    return sortWardrobeItems(visibleItems, sortBy, outfitCountMap);
  }, [archiveMode, catalogs, categories, filters, outfitCountMap, query, scopedItems, sortBy]);

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).reduce((count, [, value]) => {
        if (Array.isArray(value)) return count + value.length;
        return count + (value ? 1 : 0);
      }, 0),
    [filters]
  );

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category])),
    [categories]
  );
  const targetCatalogId = Array.isArray(fixedFilters.catalogId) ? fixedFilters.catalogId[0] : fixedFilters.catalogId;

  const toggleSelect = (itemId) => {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((entry) => entry !== itemId) : [...current, itemId]
    );
  };

  const enterSelectionMode = (itemId) => {
    setSelectionMode(true);
    setSelectedIds((current) => (current.includes(itemId) ? current : [...current, itemId]));
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const confirmDelete = (itemIds) => {
    Alert.alert(
      "Удалить вещи?",
      itemIds.length > 1
        ? "Выбранные вещи будут удалены без возможности восстановления."
        : "Вещь будет удалена без возможности восстановления.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: () => {
            if (itemIds.length > 1) {
              actions.bulkDeleteItems(itemIds);
              exitSelectionMode();
            } else {
              actions.deleteItem(itemIds[0]);
            }
          },
        },
      ]
    );
  };

  const applyBulkUpdate = () => {
    if (!selectedIds.length) return;

    if (bulkMode === "season" && bulkValue) {
      actions.bulkUpdateItems(selectedIds, { seasons: [bulkValue] });
    }

    if (bulkMode === "catalog" && bulkValue) {
      actions.bulkUpdateItems(selectedIds, { catalogId: bulkValue });
    }

    if (bulkMode === "restoreCatalog" && bulkValue) {
      actions.bulkUpdateItems(selectedIds, { catalogId: bulkValue, status: "active", isArchived: false });
    }

    setBulkMode("");
    setBulkValue("");
    exitSelectionMode();
  };

  return (
    <Screen style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.md }}>
        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery("")} placeholder="Поиск по шкафу" />
          </View>
          <ActionButton
            icon="options-outline"
            compact
            variant="secondary"
            onPress={() => setFilterVisible(true)}
            label={activeFilterCount ? String(activeFilterCount) : undefined}
          />
          <ActionButton icon="swap-vertical-outline" compact variant="secondary" onPress={() => setSortVisible(true)} />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm, alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Text style={[typography.sectionTitle, { color: colors.text }]}>{title}</Text>
            <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 2 }]}>
              {subtitle ?? `${mergedItems.length} вещей`}
            </Text>
          </View>
          {!selectionMode ? <ActionButton label="Выбрать" variant="ghost" compact onPress={() => setSelectionMode(true)} /> : null}
        </View>

        {selectionMode ? (
          <View
            style={{
              marginTop: spacing.sm,
              padding: spacing.sm,
              borderRadius: radius.lg,
              backgroundColor: colors.secondaryBackground,
            }}
          >
            <Text style={[typography.body, { color: colors.text }]}>Выбрано: {selectedIds.length}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
              {archiveMode ? (
                <Chip label="Вернуть из архива" onPress={() => setBulkMode("restoreCatalog")} />
              ) : (
                <Chip
                  label="В архив"
                  onPress={() => {
                    actions.bulkUpdateItems(selectedIds, { status: "archived", isArchived: true });
                    exitSelectionMode();
                  }}
                />
              )}
              <Chip label="Сменить сезон" onPress={() => setBulkMode("season")} />
              <Chip label="Сменить каталог" onPress={() => setBulkMode("catalog")} />
              <Chip label="Удалить" onPress={() => confirmDelete(selectedIds)} />
              <Chip label="Отмена" onPress={exitSelectionMode} />
            </View>
          </View>
        ) : null}
      </View>

      <FlatList
        data={mergedItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.md,
          paddingBottom: bottom,
          gap: spacing.sm,
        }}
        columnWrapperStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <WardrobeItemCard
              item={item}
              category={categoryById[item.categoryId]}
              selectionMode={selectionMode}
              selected={selectedIds.includes(item.id)}
              onPress={() =>
                selectionMode
                  ? toggleSelect(item.id)
                  : navigation.navigate(Routes.ItemDetails, { itemId: item.id })
              }
              onLongPress={() => enterSelectionMode(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="shirt-outline"
            title={emptyStateTitle}
            subtitle={emptyStateSubtitle}
            actionLabel="Добавить вещь"
            onAction={() => navigation.navigate(Routes.AddItem, targetCatalogId ? { catalogId: targetCatalogId } : undefined)}
          />
        }
      />
      {showFab ? <FAB onPress={() => navigation.navigate(Routes.AddItem, targetCatalogId ? { catalogId: targetCatalogId } : undefined)} style={{ bottom: 72 }} /> : null}

      <WardrobeFiltersSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={filters}
        onChangeFilters={setFilters}
        catalogs={catalogs}
        categories={categories}
        options={filterOptions}
        allowCatalog={allowCatalogFilter}
        allowCategory={allowCategoryFilter}
      />
      <WardrobeSortSheet visible={sortVisible} onClose={() => setSortVisible(false)} sortBy={sortBy} onChangeSort={setSortBy} />

      <SheetModal
        visible={Boolean(bulkMode)}
        onClose={() => {
          setBulkMode("");
          setBulkValue("");
        }}
        title={
          bulkMode === "catalog"
            ? "Изменить каталог"
            : bulkMode === "restoreCatalog"
              ? "Вернуть из архива"
              : "Изменить сезон"
        }
        footer={<ActionButton label="Применить" onPress={applyBulkUpdate} disabled={!bulkValue} fullWidth />}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {((bulkMode === "catalog" || bulkMode === "restoreCatalog")
            ? catalogs.map((catalog) => ({ id: catalog.id, title: catalog.title }))
            : seasonOptions.map((season) => ({ id: season, title: season }))
          ).map((option) => (
            <Chip key={option.id} label={option.title} selected={bulkValue === option.id} onPress={() => setBulkValue(option.id)} />
          ))}
        </View>
      </SheetModal>
    </Screen>
  );
}
