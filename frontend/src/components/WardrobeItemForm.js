import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import {
  WARDROBE_COLORS,
  WARDROBE_MATERIALS,
  WARDROBE_SEASONS,
  WARDROBE_SIZES,
  WARDROBE_STATUSES,
  WARDROBE_STYLES,
} from "../utils/wardrobe";
import ActionButton from "./ActionButton";
import Chip from "./Chip";
import Input from "./Input";
import MediaPreview from "./MediaPreview";
import SectionHeader from "./SectionHeader";

export default function WardrobeItemForm({
  draft,
  onChange,
  catalogs,
  categories,
  draftImages,
  catalogProcessingStatus,
  catalogErrorMessage,
  onSelectImageOption,
  onEditMask,
  onEnhancePhoto,
  enhanceBusy = false,
}) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === draft.categoryId) ?? categories[0],
    [categories, draft.categoryId]
  );

  const toggleArrayValue = (field, value) => {
    const current = draft[field] ?? [];
    const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
    onChange({ ...draft, [field]: next });
  };

  const setField = (field, value) => {
    onChange({ ...draft, [field]: value });
  };

  const catalogBusy = catalogProcessingStatus === "processing" || catalogProcessingStatus === "queued";

  return (
    <View>
      <View
        style={{
          borderRadius: radius.xl,
          backgroundColor: colors.secondaryBackground,
          padding: spacing.md,
        }}
      >
        <Text style={[typography.cardTitle, { color: colors.text }]}>Карточка вещи</Text>
        <MediaPreview
          source={draft.image}
          resizeMode="contain"
          placeholderScale={0.48}
          containerStyle={{
            width: "100%",
            aspectRatio: 1,
            borderRadius: radius.lg,
            marginTop: spacing.md,
            backgroundColor: colors.background,
          }}
        />
        {draftImages?.cutout || draftImages?.catalog ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.meta, { color: colors.secondaryText }]}>Вариант изображения</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {draftImages?.cutout ? (
                <Chip
                  label="Cutout"
                  selected={draft.primaryImageFileId === draftImages.cutout.fileId}
                  onPress={() => onSelectImageOption?.(draftImages.cutout)}
                />
              ) : null}
              {draftImages?.catalog ? (
                <Chip
                  label="Catalog"
                  selected={draft.primaryImageFileId === draftImages.catalog.fileId}
                  onPress={() => onSelectImageOption?.(draftImages.catalog)}
                />
              ) : null}
            </View>
            {onEditMask ? (
              <View style={{ marginTop: spacing.sm }}>
                <ActionButton
                  label="Редактировать обрезку"
                  icon="create-outline"
                  variant="secondary"
                  onPress={onEditMask}
                  fullWidth
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {onEnhancePhoto ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <ActionButton
              label={catalogBusy || enhanceBusy ? "Улучшаем..." : "Улучшить фото"}
              icon="sparkles-outline"
              onPress={onEnhancePhoto}
              disabled={catalogBusy || enhanceBusy}
              fullWidth
            />
            {catalogBusy ? (
              <Text style={[typography.caption, { color: colors.secondaryText }]}>Генерируем каталожный вариант.</Text>
            ) : null}
            {catalogErrorMessage ? <Text style={[typography.caption, { color: colors.danger }]}>{catalogErrorMessage}</Text> : null}
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Основное" />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.sm }]}>Название</Text>
        <Input
          value={draft.title}
          onChangeText={(value) => setField("title", value)}
          placeholder="Например, белая рубашка"
          style={{ marginTop: 6 }}
        />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Каталог</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {catalogs.map((catalog) => (
            <Chip
              key={catalog.id}
              label={catalog.title}
              selected={draft.catalogId === catalog.id}
              onPress={() => setField("catalogId", catalog.id)}
            />
          ))}
        </View>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Категория</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.title}
              selected={draft.categoryId === category.id}
              onPress={() =>
                onChange({
                  ...draft,
                  categoryId: category.id,
                  subcategory: category.subcategories?.includes(draft.subcategory)
                    ? draft.subcategory
                    : category.subcategories?.[0] ?? "",
                })
              }
            />
          ))}
        </View>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Подкатегория</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {(selectedCategory?.subcategories ?? []).map((subcategory) => (
            <Chip
              key={subcategory}
              label={subcategory}
              selected={draft.subcategory === subcategory}
              onPress={() => setField("subcategory", subcategory)}
            />
          ))}
        </View>
        <Input
          value={draft.subcategory}
          onChangeText={(value) => setField("subcategory", value)}
          placeholder="Уточните подкатегорию"
          style={{ marginTop: spacing.sm }}
        />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Атрибуты" />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.sm }]}>Цвет</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {WARDROBE_COLORS.map((color) => (
            <Chip
              key={color}
              label={color}
              selected={(draft.colors ?? []).includes(color)}
              onPress={() => toggleArrayValue("colors", color)}
            />
          ))}
        </View>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Сезон</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {WARDROBE_SEASONS.map((season) => (
            <Chip
              key={season}
              label={season}
              selected={(draft.seasons ?? []).includes(season)}
              onPress={() => toggleArrayValue("seasons", season)}
            />
          ))}
        </View>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Стиль</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {WARDROBE_STYLES.map((style) => (
            <Chip
              key={style}
              label={style}
              selected={(draft.styles ?? []).includes(style)}
              onPress={() => toggleArrayValue("styles", style)}
            />
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Детали" />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.sm }]}>Бренд</Text>
        <Input value={draft.brand} onChangeText={(value) => setField("brand", value)} placeholder="Например, Zara" style={{ marginTop: 6 }} />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Размер</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {WARDROBE_SIZES.map((size) => (
            <Chip key={size} label={size} selected={draft.size === size} onPress={() => setField("size", size)} />
          ))}
        </View>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Материал</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {WARDROBE_MATERIALS.map((material) => (
            <Chip
              key={material}
              label={material}
              selected={draft.material === material}
              onPress={() => setField("material", material)}
            />
          ))}
        </View>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Статус</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {WARDROBE_STATUSES.map((status) => (
            <Chip
              key={status.id}
              label={status.title}
              selected={draft.status === status.id}
              onPress={() => setField("status", status.id)}
            />
          ))}
        </View>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Заметки</Text>
        <Input
          value={draft.notes}
          onChangeText={(value) => setField("notes", value)}
          placeholder="Например, требует химчистки"
          multiline
          style={{ marginTop: 6 }}
        />
      </View>
    </View>
  );
}
