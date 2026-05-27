import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import { buildColorOptionMap, toggleColorSelection } from "../utils/wardrobeColors";
import { finalizeDraftStyleInput, normalizeStyleName } from "../utils/wardrobe";
import ActionButton from "./ActionButton";
import CategorySubcategoryPicker from "./CategorySubcategoryPicker";
import Chip from "./Chip";
import CollapsibleColorSelector from "./CollapsibleColorSelector";
import Input from "./Input";
import SectionHeader from "./SectionHeader";
import WardrobeItemImage from "./WardrobeItemImage";

function uniqueByNormalizedName(values) {
  const seen = new Set();
  const result = [];

  for (const value of values ?? []) {
    const name = String(value ?? "").trim();
    const normalized = normalizeStyleName(name);
    if (!name || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(name);
  }

  return result;
}

export default function WardrobeItemForm({
  draft,
  onChange,
  catalogs,
  categories,
  colorOptions,
  seasonOptions,
  styleOptions,
  statusOptions,
  draftImages,
  catalogProcessingStatus,
  catalogErrorMessage,
  onSelectImageOption,
  onEditMask,
  onEnhancePhoto,
  enhanceBusy = false,
  onTitleFocus,
  onTitleBlur,
}) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const colorOptionsById = useMemo(() => buildColorOptionMap(colorOptions), [colorOptions]);

  const selectedCustomStyles = useMemo(
    () =>
      uniqueByNormalizedName(draft.styles ?? []).filter(
        (style) => !styleOptions.some((availableStyle) => normalizeStyleName(availableStyle) === normalizeStyleName(style))
      ),
    [draft.styles, styleOptions]
  );

  const toggleArrayValue = (field, value) => {
    const current = draft[field] ?? [];
    const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
    onChange({ ...draft, [field]: next });
  };

  const toggleStyle = (styleName) => {
    const normalized = normalizeStyleName(styleName);
    const currentStyles = uniqueByNormalizedName(draft.styles ?? []);
    const nextStyles = currentStyles.some((style) => normalizeStyleName(style) === normalized)
      ? currentStyles.filter((style) => normalizeStyleName(style) !== normalized)
      : [...currentStyles, styleName];

    onChange({
      ...draft,
      styles: nextStyles,
      tags: nextStyles,
    });
  };

  const commitTypedStyle = () => {
    if (!draft.styleInput) {
      return;
    }
    const nextDraft = finalizeDraftStyleInput(draft, styleOptions);
    onChange(nextDraft);
  };

  const toggleColor = (colorId) => {
    const nextColorIds = toggleColorSelection(draft.colorIds ?? [], colorId, colorOptionsById);
    onChange({
      ...draft,
      colorIds: nextColorIds,
      colorDetails: nextColorIds.map((id) => colorOptionsById[id]).filter(Boolean),
    });
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
        <WardrobeItemImage
          source={draft.image}
          placeholderScale={0.48}
          containerStyle={{
            width: "100%",
            borderRadius: radius.lg,
            marginTop: spacing.md,
          }}
        />
        {draftImages?.cutout || draftImages?.catalog ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.meta, { color: colors.secondaryText }]}>Вариант изображения</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {draftImages?.cutout ? (
                <Chip
                  label="Обрезанный фон"
                  selected={draft.primaryImageFileId === draftImages.cutout.fileId}
                  onPress={() => onSelectImageOption?.(draftImages.cutout)}
                />
              ) : null}
              {draftImages?.catalog ? (
                <Chip
                  label="Каталожный вид"
                  selected={draft.primaryImageFileId === draftImages.catalog.fileId}
                  onPress={() => onSelectImageOption?.(draftImages.catalog)}
                />
              ) : null}
            </View>
            {onEditMask ? (
              <View style={{ marginTop: spacing.sm }}>
                <ActionButton
                  label="Редактировать маску"
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
          onFocus={onTitleFocus}
          onBlur={onTitleBlur}
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
        <CategorySubcategoryPicker draft={draft} categories={categories} onChange={onChange} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Атрибуты" />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.sm }]}>Цвет</Text>
        <View style={{ marginTop: spacing.xs }}>
          <CollapsibleColorSelector
            title="Цвет"
            emptyLabel="Не выбрано"
            colorOptions={colorOptions}
            selectedColorIds={draft.colorIds ?? []}
            selectedColorDetails={draft.colorDetails ?? []}
            optionDotSize={30}
            summaryDotSize={38}
            onToggleColor={toggleColor}
            onClear={() =>
              onChange({
                ...draft,
                colorIds: [],
                colorDetails: [],
              })
            }
          />
        </View>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Сезон</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {seasonOptions.map((season) => (
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
          {styleOptions.map((style) => (
            <Chip
              key={style}
              label={style}
              selected={(draft.styles ?? []).some((entry) => normalizeStyleName(entry) === normalizeStyleName(style))}
              onPress={() => toggleStyle(style)}
            />
          ))}
          {selectedCustomStyles.map((style) => (
            <Chip key={style} label={style} selected onPress={() => toggleStyle(style)} />
          ))}
        </View>
        <Input
          value={draft.styleInput ?? ""}
          onChangeText={(value) => setField("styleInput", value)}
          onSubmitEditing={commitTypedStyle}
          onBlur={commitTypedStyle}
          placeholder="Введите свой стиль"
          style={{ marginTop: spacing.sm }}
          returnKeyType="done"
        />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Детали" />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.sm }]}>Бренд</Text>
        <Input value={draft.brand} onChangeText={(value) => setField("brand", value)} placeholder="Например, Zara" style={{ marginTop: 6 }} />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Статус</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {statusOptions.map((status) => (
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
