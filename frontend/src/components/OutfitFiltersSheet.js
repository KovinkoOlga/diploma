import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import { createEmptyOutfitFilters } from "../utils/outfits";
import { resolveColorDetails, toggleFilterColorSelection } from "../utils/wardrobeColors";
import ActionButton from "./ActionButton";
import Chip from "./Chip";
import CollapsibleColorSelector from "./CollapsibleColorSelector";
import SheetModal from "./SheetModal";

function FilterSection({ title, options, value, onToggle, single = false }) {
  const { colors, typography, spacing } = useAppTheme();

  if (!options?.length) return null;

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[typography.meta, { color: colors.secondaryText, marginBottom: spacing.sm }]}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.id;
          const label = typeof option === "string" ? option : option.title ?? option.name;
          const selected = single ? value === optionValue : (value ?? []).includes(optionValue);

          return (
            <Chip key={optionValue} label={label} selected={selected} onPress={() => onToggle(optionValue)} />
          );
        })}
      </View>
    </View>
  );
}

export default function OutfitFiltersSheet({
  visible,
  onClose,
  filters,
  onApply,
  options,
  allowCollectionFilter = true,
  showWithoutCollection = true,
}) {
  const { spacing } = useAppTheme();
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => {
    if (visible) {
      setDraftFilters(filters);
    }
  }, [filters, visible]);

  const toggleArrayValue = (field, nextValue) => {
    const current = draftFilters[field] ?? [];
    const next = current.includes(nextValue)
      ? current.filter((entry) => entry !== nextValue)
      : [...current, nextValue];

    setDraftFilters((prev) => ({ ...prev, [field]: next }));
  };

  const toggleColor = (colorId) => {
    setDraftFilters((prev) => ({
      ...prev,
      color: toggleFilterColorSelection(prev.color ?? [], colorId),
    }));
  };

  const resetFilters = () => {
    setDraftFilters(
      createEmptyOutfitFilters({
        collectionIds: allowCollectionFilter ? [] : filters.collectionIds ?? [],
      })
    );
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="Фильтры"
      subtitle="Подборки, атрибуты образа и параметры вещей внутри него"
      footer={
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <ActionButton label="Сбросить" variant="secondary" onPress={resetFilters} style={{ flex: 1 }} fullWidth />
          <ActionButton
            label="Применить"
            onPress={() => {
              onApply(draftFilters);
              onClose();
            }}
            style={{ flex: 1 }}
            fullWidth
          />
        </View>
      }
    >
      {allowCollectionFilter ? (
        <FilterSection
          title="Подборки"
          options={options.collections}
          value={draftFilters.collectionIds}
          onToggle={(value) => toggleArrayValue("collectionIds", value)}
        />
      ) : null}
      {showWithoutCollection ? (
        <FilterSection
          title="Особое"
          options={[{ id: "withoutCollection", title: "Без подборки" }]}
          value={draftFilters.withoutCollection ? "withoutCollection" : ""}
          onToggle={(value) =>
            setDraftFilters((prev) => ({
              ...prev,
              withoutCollection: value === "withoutCollection" ? !prev.withoutCollection : prev.withoutCollection,
            }))
          }
          single
        />
      ) : null}
      <FilterSection
        title="Сезон образа"
        options={options.seasons}
        value={draftFilters.season}
        onToggle={(value) => toggleArrayValue("season", value)}
      />
      <FilterSection
        title="Стиль образа"
        options={options.styles}
        value={draftFilters.style}
        onToggle={(value) => toggleArrayValue("style", value)}
      />
      <FilterSection
        title="Категория вещей"
        options={options.categories}
        value={draftFilters.categoryId}
        onToggle={(value) => toggleArrayValue("categoryId", value)}
      />
      <FilterSection
        title="Подкатегория вещей"
        options={options.subcategories}
        value={draftFilters.subcategory}
        onToggle={(value) => toggleArrayValue("subcategory", value)}
      />
      <FilterSection
        title="Каталог вещей"
        options={options.catalogs}
        value={draftFilters.catalogId}
        onToggle={(value) => toggleArrayValue("catalogId", value)}
      />
      <View style={{ marginBottom: spacing.lg }}>
        <CollapsibleColorSelector
          title="Цвет вещей"
          emptyLabel="Любой цвет"
          colorOptions={options.colors}
          selectedColorIds={draftFilters.color ?? []}
          selectedColorDetails={resolveColorDetails(draftFilters.color ?? [], options.colors)}
          optionDotSize={30}
          summaryDotSize={32}
          summaryMode="first"
          onToggleColor={toggleColor}
          onClear={() => setDraftFilters((prev) => ({ ...prev, color: [] }))}
        />
      </View>
      <FilterSection
        title="Бренд вещей"
        options={options.brands}
        value={draftFilters.brand}
        onToggle={(value) => toggleArrayValue("brand", value)}
      />
      <FilterSection
        title="Статус вещей"
        options={options.statuses}
        value={draftFilters.status}
        onToggle={(value) => toggleArrayValue("status", value)}
      />
    </SheetModal>
  );
}
