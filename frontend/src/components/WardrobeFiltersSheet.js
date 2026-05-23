import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import { createEmptyWardrobeFilters } from "../utils/wardrobe";
import { resolveColorDetails, toggleFilterColorSelection } from "../utils/wardrobeColors";
import ActionButton from "./ActionButton";
import Chip from "./Chip";
import CollapsibleColorSelector from "./CollapsibleColorSelector";
import SheetModal from "./SheetModal";

function FilterSection({ title, options, value, onToggle, single = false, renderLeftSlot }) {
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
            <Chip
              key={optionValue}
              label={label}
              selected={selected}
              onPress={() => onToggle(optionValue)}
              leftSlot={renderLeftSlot ? renderLeftSlot(option) : null}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function WardrobeFiltersSheet({
  visible,
  onClose,
  filters,
  onChangeFilters,
  catalogs,
  categories,
  options,
  allowCatalog = true,
  allowCategory = true,
  showOutfitParticipation = true,
}) {
  const { spacing } = useAppTheme();

  const toggleArrayValue = (field, nextValue) => {
    const current = filters[field] ?? [];
    const next = current.includes(nextValue)
      ? current.filter((entry) => entry !== nextValue)
      : [...current, nextValue];

    onChangeFilters({ ...filters, [field]: next });
  };

  const toggleColor = (colorId) => {
    const next = toggleFilterColorSelection(filters.color ?? [], colorId);
    onChangeFilters({ ...filters, color: next });
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="Фильтры"
      subtitle="Каталог, атрибуты вещи и участие в образах"
      footer={
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <ActionButton
            label="Сбросить"
            variant="secondary"
            onPress={() => onChangeFilters(createEmptyWardrobeFilters())}
            style={{ flex: 1 }}
            fullWidth
          />
          <ActionButton label="Применить" onPress={onClose} style={{ flex: 1 }} fullWidth />
        </View>
      }
    >
      {allowCatalog ? (
        <FilterSection
          title="Каталог"
          options={catalogs}
          value={filters.catalogId}
          onToggle={(value) => toggleArrayValue("catalogId", value)}
        />
      ) : null}
      {allowCategory ? (
        <FilterSection
          title="Категория"
          options={categories}
          value={filters.categoryId}
          onToggle={(value) => toggleArrayValue("categoryId", value)}
        />
      ) : null}
      <FilterSection
        title="Подкатегория"
        options={options.subcategories}
        value={filters.subcategory}
        onToggle={(value) => toggleArrayValue("subcategory", value)}
      />
      <View style={{ marginBottom: spacing.lg }}>
        <CollapsibleColorSelector
          title="Цвет"
          emptyLabel="Любой цвет"
          colorOptions={options.colors}
          selectedColorIds={filters.color ?? []}
          selectedColorDetails={resolveColorDetails(filters.color ?? [], options.colors)}
          optionDotSize={30}
          summaryDotSize={32}
          summaryMode="first"
          onToggleColor={toggleColor}
          onClear={() => onChangeFilters({ ...filters, color: [] })}
        />
      </View>
      <FilterSection
        title="Сезон"
        options={options.seasons}
        value={filters.season}
        onToggle={(value) => toggleArrayValue("season", value)}
      />
      <FilterSection
        title="Стиль"
        options={options.styles}
        value={filters.style}
        onToggle={(value) => toggleArrayValue("style", value)}
      />
      <FilterSection
        title="Бренд"
        options={options.brands}
        value={filters.brand}
        onToggle={(value) => toggleArrayValue("brand", value)}
      />
      <FilterSection
        title="Статус"
        options={options.statuses}
        value={filters.status}
        onToggle={(value) => toggleArrayValue("status", value)}
      />
      {showOutfitParticipation ? (
        <FilterSection
          title="Участие в образах"
          options={[
            { id: "withOutfits", title: "Есть в образах" },
            { id: "withoutOutfits", title: "Пока не используется" },
          ]}
          value={filters.outfitParticipation}
          onToggle={(value) =>
            onChangeFilters({
              ...filters,
              outfitParticipation: filters.outfitParticipation === value ? "" : value,
            })
          }
          single
        />
      ) : null}
    </SheetModal>
  );
}
