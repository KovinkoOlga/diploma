import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import Screen, { useScreenContentInsets } from "../../components/Screen";
import AppHeader from "../../components/AppHeader";
import SearchBar from "../../components/SearchBar";
import ActionButton from "../../components/ActionButton";
import EmptyState from "../../components/EmptyState";
import FAB from "../../components/FAB";
import SheetModal from "../../components/SheetModal";
import AnimatedSegmentedBar from "../../components/AnimatedSegmentedBar";
import OutfitCard from "../../components/OutfitCard";
import OutfitFiltersSheet from "../../components/OutfitFiltersSheet";
import OutfitSortSheet from "../../components/OutfitSortSheet";
import { useAppTheme } from "../../theme/ThemeProvider";
import { Routes } from "../../navigation/routes";
import { useWardrobe } from "../../store/WardrobeStore";
import {
  ALL_OUTFITS_COLLECTION_ID,
  applyOutfitFilters,
  countOutfitFilters,
  createEmptyOutfitFilters,
  getOutfitFilterOptions,
  matchesOutfitSearch,
  sortOutfits,
} from "../../utils/outfits";

export default function OutfitsHomeScreen({ navigation }) {
  const { spacing, layout, colors, typography } = useAppTheme();
  const { bottom } = useScreenContentInsets(112);
  const {
    outfits,
    items,
    categories,
    catalogs,
    colorOptions,
    seasonOptions,
    styleOptions,
    statusOptions,
    outfitCollections,
  } = useWardrobe();
  const [activeCollectionId, setActiveCollectionId] = useState(ALL_OUTFITS_COLLECTION_ID);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(createEmptyOutfitFilters());
  const [sortBy, setSortBy] = useState("recent");
  const [menuVisible, setMenuVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);

  useEffect(() => {
    if (activeCollectionId === ALL_OUTFITS_COLLECTION_ID) return;
    if (!outfitCollections.some((collection) => collection.id === activeCollectionId)) {
      setActiveCollectionId(ALL_OUTFITS_COLLECTION_ID);
    }
  }, [activeCollectionId, outfitCollections]);

  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const categoriesById = useMemo(() => Object.fromEntries(categories.map((entry) => [entry.id, entry])), [categories]);
  const catalogsById = useMemo(() => Object.fromEntries(catalogs.map((entry) => [entry.id, entry])), [catalogs]);
  const collectionOptions = useMemo(
    () => [
      { value: ALL_OUTFITS_COLLECTION_ID, label: "Все образы" },
      ...outfitCollections.map((collection) => ({ value: collection.id, label: collection.title })),
    ],
    [outfitCollections]
  );
  const selectedCollection = useMemo(
    () => outfitCollections.find((collection) => collection.id === activeCollectionId) ?? null,
    [activeCollectionId, outfitCollections]
  );
  const scopedOutfits = useMemo(
    () =>
      activeCollectionId === ALL_OUTFITS_COLLECTION_ID
        ? outfits
        : outfits.filter((outfit) => outfit.collectionIds?.includes(activeCollectionId)),
    [activeCollectionId, outfits]
  );
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
    const filtered = applyOutfitFilters(outfits, filters, {
      activeCollectionId,
      itemById,
    }).filter((outfit) =>
      matchesOutfitSearch(outfit, query, {
        itemById,
        categoriesById,
        catalogsById,
      })
    );

    return sortOutfits(filtered, sortBy);
  }, [activeCollectionId, catalogsById, categoriesById, filters, itemById, outfits, query, sortBy]);
  const activeFilterCount = useMemo(
    () =>
      countOutfitFilters(filters, {
        includeCollection: activeCollectionId === ALL_OUTFITS_COLLECTION_ID,
        includeWithoutCollection: activeCollectionId === ALL_OUTFITS_COLLECTION_ID,
      }),
    [activeCollectionId, filters]
  );

  const openCreateOutfit = () => {
    const params =
      activeCollectionId === ALL_OUTFITS_COLLECTION_ID
        ? undefined
        : { initialCollectionIds: [activeCollectionId] };
    navigation.navigate(Routes.OutfitEditor, params);
  };

  const isGlobalEmpty = outfits.length === 0;
  const isSelectedCollectionEmpty =
    activeCollectionId !== ALL_OUTFITS_COLLECTION_ID && scopedOutfits.length === 0;

  return (
    <Screen
      header={
        <AppHeader
          title="Образы"
          right={<ActionButton icon="ellipsis-horizontal" compact variant="ghost" onPress={() => setMenuVisible(true)} />}
        />
      }
    >
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

            <View style={{ marginTop: spacing.lg }}>
              <AnimatedSegmentedBar
                options={collectionOptions}
                activeValue={activeCollectionId}
                onSelect={setActiveCollectionId}
              />
            </View>

            <Text style={[typography.caption, { color: colors.secondaryText, marginTop: spacing.sm }]}>
              {activeCollectionId === ALL_OUTFITS_COLLECTION_ID
                ? `${visibleOutfits.length} образов после поиска и фильтров`
                : selectedCollection
                  ? `Подборка «${selectedCollection.title}»`
                  : ""}
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
          isGlobalEmpty ? (
            <EmptyState
              icon="bookmark-outline"
              title="Пока нет образов"
              subtitle="Соберите первый образ из вещей вашего шкафа."
              actionLabel="Создать образ"
              onAction={openCreateOutfit}
            />
          ) : isSelectedCollectionEmpty ? (
            <View>
              <EmptyState
                icon="albums-outline"
                title="В подборке пока нет образов"
                subtitle="Можно создать новый образ сразу в этой подборке или добавить уже существующие."
              />
              <View style={{ gap: spacing.sm }}>
                <ActionButton label="Создать образ" icon="add-outline" onPress={openCreateOutfit} fullWidth />
                <ActionButton
                  label="Добавить существующие"
                  icon="duplicate-outline"
                  variant="secondary"
                  onPress={() => navigation.navigate(Routes.OutfitCollectionAddExisting, { collectionId: activeCollectionId })}
                  fullWidth
                />
              </View>
            </View>
          ) : (
            <EmptyState
              icon="search-outline"
              title="Ничего не найдено"
              subtitle="Попробуйте изменить запрос или сбросить фильтры."
              actionLabel="Сбросить фильтры"
              onAction={() => {
                setQuery("");
                setFilters(createEmptyOutfitFilters());
              }}
            />
          )
        }
      />

      {activeCollectionId !== ALL_OUTFITS_COLLECTION_ID ? (
        <ActionButton
          label="Добавить существующие"
          icon="duplicate-outline"
          variant="secondary"
          onPress={() => navigation.navigate(Routes.OutfitCollectionAddExisting, { collectionId: activeCollectionId })}
          style={{ position: "absolute", right: 16, bottom: 132 }}
        />
      ) : null}
      <FAB onPress={openCreateOutfit} size={56} iconSize={24} style={{ bottom: 72 }} />

      <SheetModal visible={menuVisible} onClose={() => setMenuVisible(false)} title="Действия">
        <View style={{ gap: spacing.sm }}>
          <ActionButton
            label="Справочники"
            icon="albums-outline"
            variant="secondary"
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate(Routes.OutfitsDictionaries);
            }}
            fullWidth
          />
        </View>
      </SheetModal>

      <OutfitFiltersSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={filters}
        onApply={setFilters}
        options={filterOptions}
        allowCollectionFilter={activeCollectionId === ALL_OUTFITS_COLLECTION_ID}
        showWithoutCollection={activeCollectionId === ALL_OUTFITS_COLLECTION_ID}
      />
      <OutfitSortSheet visible={sortVisible} onClose={() => setSortVisible(false)} sortBy={sortBy} onChangeSort={setSortBy} />
    </Screen>
  );
}
