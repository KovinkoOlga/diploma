import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import Chip from "./Chip";
import Input from "./Input";

function suggestionLabel(suggestion, fallbackCategoryTitle) {
  const confidence = Math.round(Number(suggestion?.confidence ?? 0) * 100);
  const categoryTitle = suggestion?.categoryTitle || fallbackCategoryTitle || "Категория";
  return `${suggestion?.subcategory ?? ""} · ${categoryTitle} · ${confidence}%`;
}

export default function CategorySubcategoryPicker({ draft, categories, onChange }) {
  const { colors, typography, spacing } = useAppTheme();

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === draft.categoryId) ?? categories[0] ?? null,
    [categories, draft.categoryId]
  );

  const suggestions = useMemo(() => {
    if (!Array.isArray(draft.subcategorySuggestions)) return [];
    return draft.subcategorySuggestions.slice(0, 3);
  }, [draft.subcategorySuggestions]);

  const setDraft = (patch) => {
    onChange({ ...draft, ...patch });
  };

  const changeCategory = (categoryId) => {
    const nextCategory = categories.find((category) => category.id === categoryId);
    const nextSubcategory =
      nextCategory?.subcategories?.includes(draft.subcategory)
        ? draft.subcategory
        : "";
    setDraft({
      categoryId,
      subcategory: nextSubcategory,
    });
  };

  const applySuggestion = (suggestion) => {
    if (!suggestion?.categoryId || !suggestion?.subcategory) return;
    setDraft({
      categoryId: suggestion.categoryId,
      subcategory: suggestion.subcategory,
    });
  };

  return (
    <View>
      <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Категория</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.title}
            selected={draft.categoryId === category.id}
            onPress={() => changeCategory(category.id)}
          />
        ))}
      </View>

      {suggestions.length ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[typography.meta, { color: colors.secondaryText }]}>Предложено AI</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {suggestions.map((suggestion, index) => {
              const categoryTitle =
                categories.find((category) => category.id === suggestion.categoryId)?.title;
              const isSelected =
                draft.categoryId === suggestion.categoryId &&
                draft.subcategory === suggestion.subcategory;
              return (
                <Chip
                  key={`${suggestion.subcategoryId ?? suggestion.subcategoryKey ?? suggestion.subcategory}_${index}`}
                  label={suggestionLabel(suggestion, categoryTitle)}
                  selected={isSelected}
                  onPress={() => applySuggestion(suggestion)}
                />
              );
            })}
          </View>
        </View>
      ) : null}

      <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Подкатегория</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {(selectedCategory?.subcategories ?? []).map((subcategory) => (
          <Chip
            key={subcategory}
            label={subcategory}
            selected={draft.subcategory === subcategory}
            onPress={() => setDraft({ subcategory })}
          />
        ))}
      </View>
      <Input
        value={draft.subcategory}
        onChangeText={(value) => setDraft({ subcategory: value })}
        placeholder="Уточните подкатегорию"
        style={{ marginTop: spacing.sm }}
      />
    </View>
  );
}
