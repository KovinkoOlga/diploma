import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import Screen, { useScreenContentInsets } from "../../components/Screen";
import AppHeader from "../../components/AppHeader";
import SearchBar from "../../components/SearchBar";
import ActionButton from "../../components/ActionButton";
import EmptyState from "../../components/EmptyState";
import FAB from "../../components/FAB";
import SheetModal from "../../components/SheetModal";
import CategoryIcon from "../../components/CategoryIcon";
import WardrobeFiltersSheet from "../../components/WardrobeFiltersSheet";
import WardrobeSortSheet from "../../components/WardrobeSortSheet";
import { useAppTheme } from "../../theme/ThemeProvider";
import { Routes } from "../../navigation/routes";
import { useWardrobe } from "../../store/WardrobeStore";
import {
  applyWardrobeFilters,
  createEmptyWardrobeFilters,
  getOutfitCountMap,
  getWardrobeFilterOptions,
  matchesWardrobeSearch,
  formatWardrobeItemCount,
  sortWardrobeItems,
} from "../../utils/wardrobe";
import { WARDROBE_PHOTO_MODES, openWardrobePhotoFlow } from "../../utils/wardrobePhotoFlow";

function CategoryTile({ category, count, onPress }) {
  const { colors, typography, radius } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: "48.2%", opacity: pressed ? 0.82 : 1 }]}>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.secondaryBackground,
          paddingHorizontal: 10,
          paddingVertical: 8,
          height: 120,
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CategoryIcon categoryId={category.id} icon={category.icon} size={26} color={colors.text} />
        </View>
        <View>
          <Text
            style={[
              typography.cardTitle,
              {
                color: colors.text,
                fontSize: 16,
                lineHeight: 19,
              },
            ]}
            numberOfLines={2}
          >
            {category.title}
          </Text>
          <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 1 }]}>
            {formatWardrobeItemCount(count)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function CatalogSegmentedBar({ catalogs, activeCatalogId, onSelect }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const scrollRef = useRef(null);
  const layoutsRef = useRef({});
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const layout = layoutsRef.current[activeCatalogId];
    if (!layout) return;

    if (!ready) {
      indicatorX.setValue(layout.x);
      indicatorWidth.setValue(layout.width);
      setReady(true);
      return;
    }

    Animated.parallel([
      Animated.timing(indicatorX, {
        toValue: layout.x,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(indicatorWidth, {
        toValue: layout.width,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();

    scrollRef.current?.scrollTo({
      x: Math.max(layout.x - 40, 0),
      animated: true,
    });
  }, [activeCatalogId, indicatorWidth, indicatorX, ready]);

  return (
    <View
      style={{
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBackground,
        padding: 4,
        overflow: "hidden",
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ borderRadius: radius.pill, overflow: "hidden" }}
        contentContainerStyle={{ position: "relative", flexDirection: "row", alignItems: "center", gap: 4 }}
      >
        {ready ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: indicatorX,
              width: indicatorWidth,
              borderRadius: radius.pill,
              backgroundColor: colors.text,
            }}
          />
        ) : null}
        {catalogs.map((catalog) => {
          const selected = activeCatalogId === catalog.id;

          return (
            <Pressable
              key={catalog.id}
              onPress={() => onSelect(catalog.id)}
              onLayout={({ nativeEvent }) => {
                layoutsRef.current[catalog.id] = {
                  x: nativeEvent.layout.x,
                  width: nativeEvent.layout.width,
                };
                if (catalog.id === activeCatalogId && !ready) {
                  indicatorX.setValue(nativeEvent.layout.x);
                  indicatorWidth.setValue(nativeEvent.layout.width);
                  setReady(true);
                }
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.84 : 1 }]}
            >
              <View
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs + 2,
                  minHeight: 36,
                  justifyContent: "center",
                }}
              >
                <Text
                  style={[
                    typography.caption,
                    {
                      color: selected ? colors.background : colors.text,
                      fontWeight: selected ? "600" : "500",
                    },
                  ]}
                >
                  {catalog.title}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ThreeActionEmpty({ navigation, catalogId }) {
  const { spacing } = useAppTheme();

  return (
    <View>
      <EmptyState
        icon="shirt-outline"
        title="Ваш цифровой шкаф пока пуст"
        subtitle="Добавьте первую вещь: сфотографируйте её или загрузите из галереи."
      />
      <View style={{ gap: spacing.sm }}>
        <ActionButton
          label="Сфотографировать"
          icon="camera-outline"
          onPress={() => openWardrobePhotoFlow({ navigation, mode: WARDROBE_PHOTO_MODES.camera, catalogId })}
          fullWidth
        />
        <ActionButton
          label="Загрузить"
          icon="image-outline"
          variant="secondary"
          onPress={() => openWardrobePhotoFlow({ navigation, mode: WARDROBE_PHOTO_MODES.gallery, catalogId })}
          fullWidth
        />
      </View>
    </View>
  );
}

export default function WardrobeHomeScreen({ navigation }) {
  const { colors, typography, spacing, layout } = useAppTheme();
  const { bottom } = useScreenContentInsets(96);
  const { items, catalogs, categories, colorOptions, seasonOptions, styleOptions, statusOptions, outfits } = useWardrobe();
  const [activeCatalogId, setActiveCatalogId] = useState(catalogs[0]?.id ?? "main");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(createEmptyWardrobeFilters());
  const [sortBy, setSortBy] = useState("recent");
  const [menuVisible, setMenuVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);

  useEffect(() => {
    if (catalogs.length && !catalogs.some((catalog) => catalog.id === activeCatalogId)) {
      setActiveCatalogId(catalogs[0].id);
    }
  }, [activeCatalogId, catalogs]);

  const outfitCountMap = useMemo(() => getOutfitCountMap(outfits), [outfits]);
  const activeItems = useMemo(() => items.filter((item) => !item.isArchived), [items]);
  const catalogItems = useMemo(() => activeItems.filter((item) => item.catalogId === activeCatalogId), [activeCatalogId, activeItems]);
  const filterOptions = useMemo(
    () => getWardrobeFilterOptions(catalogItems, colorOptions, { seasonOptions, styleOptions, statusOptions }),
    [catalogItems, colorOptions, seasonOptions, statusOptions, styleOptions]
  );
  const filteredCatalogItems = useMemo(() => {
    const filtered = applyWardrobeFilters(catalogItems, filters, outfitCountMap).filter((item) =>
      matchesWardrobeSearch(item, query, categories, catalogs)
    );

    return sortWardrobeItems(filtered, sortBy, outfitCountMap);
  }, [catalogItems, catalogs, categories, filters, outfitCountMap, query, sortBy]);
  const categoryTiles = useMemo(() => [{ id: "all", title: "Все вещи", icon: "all" }, ...categories], [categories]);
  const activeFilterCount = useMemo(
    () =>
      Object.values(filters).reduce((count, value) => {
        if (Array.isArray(value)) return count + value.length;
        return count + (value ? 1 : 0);
      }, 0),
    [filters]
  );
  const categoryCounts = useMemo(
    () =>
      categoryTiles.map((category) => ({
        ...category,
        count:
          category.id === "all"
            ? filteredCatalogItems.length
            : filteredCatalogItems.filter((item) => item.categoryId === category.id).length,
      })),
    [categoryTiles, filteredCatalogItems]
  );

  const openWithState = (routeName, params = {}) => {
    navigation.navigate(routeName, {
      ...params,
      initialQuery: query,
      initialFilters: filters,
      initialSortBy: sortBy,
    });
  };

  const openCategory = (categoryId) => {
    if (categoryId === "all") {
      openWithState(Routes.WardrobeAllItems, { catalogId: activeCatalogId });
      return;
    }

    openWithState(Routes.WardrobeCategory, { catalogId: activeCatalogId, categoryId });
  };

  if (!activeItems.length) {
    return (
      <Screen
        header={
          <AppHeader
            title="Шкаф"
            right={<ActionButton icon="ellipsis-horizontal" compact variant="ghost" onPress={() => setMenuVisible(true)} />}
          />
        }
      >
        <View style={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg }}>
          <ThreeActionEmpty navigation={navigation} catalogId={activeCatalogId} />
        </View>
        <SheetModal visible={menuVisible} onClose={() => setMenuVisible(false)} title="Действия">
          <View style={{ gap: spacing.sm }}>
            <ActionButton
              label="Как снять вещь"
              icon="sparkles-outline"
              variant="secondary"
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate(Routes.WardrobePhotoGuide, { mode: WARDROBE_PHOTO_MODES.camera, catalogId: activeCatalogId });
              }}
              fullWidth
            />
            <ActionButton
              label="Справочники"
              icon="albums-outline"
              variant="secondary"
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate(Routes.WardrobeManageCatalogs);
              }}
              fullWidth
            />
            <ActionButton
              label="Открыть архив"
              icon="archive-outline"
              variant="secondary"
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate(Routes.WardrobeArchive);
              }}
              fullWidth
            />
          </View>
        </SheetModal>
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <AppHeader
          title="Шкаф"
          right={<ActionButton icon="ellipsis-horizontal" compact variant="ghost" onPress={() => setMenuVisible(true)} />}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.md,
          paddingBottom: bottom,
        }}
      >
        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery("")} placeholder="Найти вещь" />
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
          <CatalogSegmentedBar catalogs={catalogs} activeCatalogId={activeCatalogId} onSelect={setActiveCatalogId} />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Text style={[typography.sectionTitle, { color: colors.text }]}>Категории</Text>
          <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 4 }]}>
            {filteredCatalogItems.length
              ? `Найдено ${formatWardrobeItemCount(filteredCatalogItems.length)} в текущем каталоге`
              : "Измените фильтры или добавьте новую вещь"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
            {categoryCounts.map((category) => (
              <CategoryTile key={category.id} category={category} count={category.count} onPress={() => openCategory(category.id)} />
            ))}
          </View>
        </View>

        {!filteredCatalogItems.length ? (
          <View style={{ marginTop: spacing.lg }}>
            <EmptyState
              icon="search-outline"
              title="Ничего не найдено"
              subtitle="Попробуйте изменить фильтры или добавить новую вещь"
              actionLabel="Сбросить фильтры"
              onAction={() => {
                setQuery("");
                setFilters(createEmptyWardrobeFilters());
              }}
            />
          </View>
        ) : null}
      </ScrollView>

      <FAB onPress={() => navigation.navigate(Routes.AddItem, { catalogId: activeCatalogId })} style={{ bottom: 72 }} />

      <SheetModal visible={menuVisible} onClose={() => setMenuVisible(false)} title="Действия">
        <View style={{ gap: spacing.sm }}>
          <ActionButton
            label="Как снять вещь"
            icon="sparkles-outline"
            variant="secondary"
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate(Routes.WardrobePhotoGuide, { mode: WARDROBE_PHOTO_MODES.camera, catalogId: activeCatalogId });
            }}
            fullWidth
          />
          <ActionButton
            label="Справочники"
            icon="albums-outline"
            variant="secondary"
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate(Routes.WardrobeManageCatalogs);
            }}
            fullWidth
          />
          <ActionButton
            label="Выбрать несколько вещей"
            icon="checkmark-done-outline"
            variant="secondary"
            onPress={() => {
              setMenuVisible(false);
              openWithState(Routes.WardrobeAllItems, { catalogId: activeCatalogId, selectionMode: true });
            }}
            fullWidth
          />
          <ActionButton
            label="Открыть архив"
            icon="archive-outline"
            variant="secondary"
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate(Routes.WardrobeArchive);
            }}
            fullWidth
          />
        </View>
      </SheetModal>

      <WardrobeFiltersSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={filters}
        onChangeFilters={setFilters}
        catalogs={catalogs}
        categories={categories}
        options={filterOptions}
        allowCatalog={false}
      />
      <WardrobeSortSheet visible={sortVisible} onClose={() => setSortVisible(false)} sortBy={sortBy} onChangeSort={setSortBy} />
    </Screen>
  );
}
