import React, { useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import Screen, { useScreenContentInsets } from "../../components/Screen";
import SearchBar from "../../components/SearchBar";
import ActionButton from "../../components/ActionButton";
import EmptyState from "../../components/EmptyState";
import OutfitCard from "../../components/OutfitCard";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { matchesOutfitSearch } from "../../utils/outfits";

export default function AddOutfitsToCollectionScreen({ navigation, route }) {
  const { spacing, layout, colors, radius, typography } = useAppTheme();
  const { bottom } = useScreenContentInsets(24);
  const { collectionId } = route.params ?? {};
  const { outfits, items, categories, catalogs, outfitCollections, actions } = useWardrobe();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const collection = useMemo(
    () => outfitCollections.find((entry) => entry.id === collectionId),
    [collectionId, outfitCollections]
  );
  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const categoriesById = useMemo(() => Object.fromEntries(categories.map((entry) => [entry.id, entry])), [categories]);
  const catalogsById = useMemo(() => Object.fromEntries(catalogs.map((entry) => [entry.id, entry])), [catalogs]);
  const availableOutfits = useMemo(
    () => outfits.filter((outfit) => !outfit.collectionIds?.includes(collectionId)),
    [collectionId, outfits]
  );
  const filteredOutfits = useMemo(
    () =>
      availableOutfits.filter((outfit) =>
        matchesOutfitSearch(outfit, query, { itemById, categoriesById, catalogsById })
      ),
    [availableOutfits, catalogsById, categoriesById, itemById, query]
  );

  const toggleSelected = (outfitId) => {
    setSelectedIds((prev) =>
      prev.includes(outfitId) ? prev.filter((entry) => entry !== outfitId) : [...prev, outfitId]
    );
  };

  return (
    <Screen padded={false}>
      <FlatList
        data={filteredOutfits}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.md,
          paddingBottom: bottom + 80,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typography.body, { color: colors.secondaryText, marginBottom: spacing.sm }]}>
              {collection ? `Добавьте в подборку «${collection.title}» уже сохранённые образы.` : "Выберите образы для добавления."}
            </Text>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              onClear={() => setQuery("")}
              placeholder="Найти образ"
            />
          </View>
        }
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item.id);
          return (
            <View style={{ flex: 1 }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: selected ? colors.text : "transparent",
                  borderRadius: radius.lg,
                  padding: 4,
                }}
              >
                <OutfitCard
                  outfit={item}
                  items={(item.itemIds ?? []).map((itemId) => itemById[itemId]).filter(Boolean)}
                  onPress={() => toggleSelected(item.id)}
                />
              </View>
              <ActionButton
                label={selected ? "Убрать" : "Выбрать"}
                variant={selected ? "primary" : "secondary"}
                onPress={() => toggleSelected(item.id)}
                style={{ marginTop: spacing.xs }}
                fullWidth
              />
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <EmptyState
            icon="albums-outline"
            title={availableOutfits.length ? "Ничего не найдено" : "Все образы уже добавлены"}
            subtitle={
              availableOutfits.length
                ? "Попробуйте изменить поисковый запрос."
                : "В этой подборке уже есть все доступные образы."
            }
            actionLabel={availableOutfits.length ? "Сбросить поиск" : undefined}
            onAction={availableOutfits.length ? () => setQuery("") : undefined}
          />
        }
      />

      <View
        style={{
          position: "absolute",
          left: layout.screenPadding,
          right: layout.screenPadding,
          bottom: 24,
        }}
      >
        <ActionButton
          label={saving ? "Добавляем..." : `Добавить (${selectedIds.length})`}
          icon="add-outline"
          onPress={async () => {
            if (!selectedIds.length || saving) return;
            setSaving(true);
            try {
              await actions.addOutfitsToCollection(collectionId, selectedIds);
              navigation.goBack();
            } finally {
              setSaving(false);
            }
          }}
          disabled={!selectedIds.length || saving}
          fullWidth
        />
      </View>
    </Screen>
  );
}
