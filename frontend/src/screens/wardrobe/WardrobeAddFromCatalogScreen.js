import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../../components/Screen";
import SearchBar from "../../components/SearchBar";
import Chip from "../../components/Chip";
import MediaPreview from "../../components/MediaPreview";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";
import { matchesWardrobeSearch } from "../../utils/wardrobe";

export default function WardrobeAddFromCatalogScreen({ navigation, route }) {
  const { colors, typography, spacing, radius, layout } = useAppTheme();
  const { templates, categories, catalogs, actions } = useWardrobe();
  const [catalogId, setCatalogId] = useState(route.params?.catalogId ?? catalogs[0]?.id ?? "main");
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (catalogs.length && !catalogs.some((catalog) => catalog.id === catalogId)) {
      setCatalogId(catalogs[0].id);
    }
  }, [catalogId, catalogs]);

  const filteredTemplates = useMemo(() => {
    const byCategory =
      activeCategoryId === "all"
        ? templates
        : templates.filter((template) => template.categoryId === activeCategoryId);

    return byCategory.filter((template) =>
      matchesWardrobeSearch(
        {
          ...template,
          seasons: template.seasons,
          styles: template.styles,
        },
        query,
        categories,
        catalogs
      )
    );
  }, [activeCategoryId, catalogs, categories, query, templates]);

  return (
    <Screen style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.md }}>
        <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery("")} placeholder="Поиск по базовому каталогу" />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.lg, marginBottom: spacing.sm }]}>Каталог назначения</Text>
        <FlatList
          horizontal
          data={catalogs}
          keyExtractor={(catalog) => catalog.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => <Chip label={item.title} selected={catalogId === item.id} onPress={() => setCatalogId(item.id)} />}
        />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.lg, marginBottom: spacing.sm }]}>Категории</Text>
        <FlatList
          horizontal
          data={[{ id: "all", title: "Все" }, ...categories]}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <Chip label={item.title} selected={activeCategoryId === item.id} onPress={() => setActiveCategoryId(item.id)} />
          )}
        />
      </View>

      <FlatList
        data={filteredTemplates}
        keyExtractor={(template) => template.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: 120,
          gap: spacing.sm,
        }}
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                backgroundColor: colors.secondaryBackground,
                padding: spacing.sm,
              }}
            >
              <MediaPreview
                source={item.image}
                placeholderScale={0.48}
                containerStyle={{
                  width: "100%",
                  aspectRatio: 0.9,
                  borderRadius: radius.md,
                  backgroundColor: colors.background,
                }}
              />
              <Text style={[typography.cardTitle, { color: colors.text, marginTop: 10 }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 4 }]} numberOfLines={1}>
                {item.subcategory}
              </Text>
              <Text
                onPress={async () => {
                  const draft = await actions.createDraftFromTemplate(item.id, catalogId);
                  navigation.navigate(Routes.WardrobeConfirmItem, {
                    draftId: draft.id,
                    draft: draft.draft,
                  });
                }}
                style={[
                  typography.button,
                  {
                    color: colors.text,
                    marginTop: spacing.sm,
                    paddingVertical: spacing.xs,
                  },
                ]}
              >
                Выбрать шаблон
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: spacing.xxl }}>
            <Ionicons name="search-outline" size={24} color={colors.secondaryText} />
            <Text style={[typography.sectionTitle, { color: colors.text, marginTop: spacing.sm }]}>Шаблоны не найдены</Text>
            <Text style={[typography.body, { color: colors.secondaryText, marginTop: 6, textAlign: "center" }]}>
              Попробуйте изменить запрос или выбрать другую категорию.
            </Text>
          </View>
        }
      />
    </Screen>
  );
}
