import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Input from "../../components/Input";
import Chip from "../../components/Chip";
import SectionHeader from "../../components/SectionHeader";
import ActionButton from "../../components/ActionButton";
import OutfitCoverPreview from "../../components/OutfitCoverPreview";
import SearchBar from "../../components/SearchBar";
import WardrobeItemCard from "../../components/WardrobeItemCard";
import WardrobeFiltersSheet from "../../components/WardrobeFiltersSheet";
import WardrobeItemImage from "../../components/WardrobeItemImage";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { defaultOutfitDraft, syncCoverStateWithItems } from "../../utils/outfitCover";
import {
  createEmptyWardrobeFilters,
  getWardrobeFilterOptions,
  applyWardrobeFilters,
  matchesWardrobeSearch,
  normalizeStyleName,
} from "../../utils/wardrobe";
import { normalizeOutfitSelectableName, formatOutfitItemCount } from "../../utils/outfits";
import { openOutfitCoverEditor, OUTFIT_MIN_ITEMS_MESSAGE } from "../../utils/outfitEditor";

function countFilters(filters) {
  return Object.values(filters).reduce((count, value) => {
    if (Array.isArray(value)) return count + value.length;
    return count + (value ? 1 : 0);
  }, 0);
}

function SelectedItemCard({ item, category, onRemove }) {
  const { colors, spacing, radius, typography } = useAppTheme();

  return (
    <View
      style={{
        width: 156,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        backgroundColor: colors.secondaryBackground,
        padding: spacing.sm,
      }}
    >
      <WardrobeItemImage
        source={item.image}
        placeholderScale={0.5}
        containerStyle={{
          width: "100%",
          borderRadius: radius.md,
        }}
      />
      <Text style={[typography.cardTitle, { color: colors.text, marginTop: spacing.sm }]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 4 }]} numberOfLines={1}>
        {[category?.title, item.subcategory].filter(Boolean).join(" · ") || "Вещь"}
      </Text>
      <ActionButton
        label="Убрать"
        variant="secondary"
        onPress={onRemove}
        style={{ marginTop: spacing.sm }}
        fullWidth
      />
    </View>
  );
}

function uniqueValues(values) {
  return Array.from(new Set((values ?? []).filter(Boolean)));
}

function resolveExistingCollection(collections, title) {
  const normalized = normalizeOutfitSelectableName(title);
  return collections.find(
    (collection) => normalizeOutfitSelectableName(collection.title) === normalized
  );
}

export default function OutfitEditorScreen({ navigation, route }) {
  const { colors, typography, spacing, radius } = useAppTheme();
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
    outfitDraftSessions,
    actions,
  } = useWardrobe();
  const existing = useMemo(
    () => outfits.find((entry) => entry.id === route.params?.outfitId),
    [outfits, route.params?.outfitId]
  );
  const seedItemId = route.params?.seedItemId;
  const initialCollectionIds = route.params?.initialCollectionIds ?? [];
  const [draftSessionId, setDraftSessionId] = useState(() => route.params?.draftSessionId ?? null);
  const [saving, setSaving] = useState(false);
  const [preparingCoverImages, setPreparingCoverImages] = useState(false);
  const [coverImagesError, setCoverImagesError] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [itemFilters, setItemFilters] = useState(createEmptyWardrobeFilters());
  const [itemFiltersVisible, setItemFiltersVisible] = useState(false);
  const autoOpenCoverHandledRef = useRef(false);
  const draftSavedRef = useRef(false);

  const buildInitialDraft = useMemo(
    () => () => {
      const baseDraft = defaultOutfitDraft(existing, seedItemId);
      const mergedCollectionIds = Array.from(
        new Set([...(existing?.collectionIds ?? []), ...initialCollectionIds])
      );

      return {
        ...baseDraft,
        season: existing?.season?.length ? existing.season : seasonOptions.slice(),
        tags: existing?.tags?.length ? existing.tags.slice(0, 1) : [],
        collectionIds: mergedCollectionIds,
        styleInput: "",
        collectionInput: "",
        pendingCollectionTitles: [],
      };
    },
    [existing, initialCollectionIds, seasonOptions, seedItemId]
  );

  useEffect(() => {
    if (draftSessionId) return;
    const nextSessionId = actions.createOutfitDraftSession(buildInitialDraft());
    setDraftSessionId(nextSessionId);
  }, [actions, buildInitialDraft, draftSessionId]);

  useEffect(
    () => () => {
      if (!draftSavedRef.current && draftSessionId) {
        actions.clearOutfitDraftSession(draftSessionId);
      }
    },
    [actions, draftSessionId]
  );

  const draft = draftSessionId ? outfitDraftSessions[draftSessionId] || buildInitialDraft() : null;
  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const categoriesById = useMemo(
    () => Object.fromEntries(categories.map((entry) => [entry.id, entry])),
    [categories]
  );
  const activeItems = useMemo(() => items.filter((item) => !item.isArchived), [items]);
  const itemFilterOptions = useMemo(
    () =>
      getWardrobeFilterOptions(activeItems, colorOptions, {
        seasonOptions,
        styleOptions,
        statusOptions,
      }),
    [activeItems, colorOptions, seasonOptions, statusOptions, styleOptions]
  );
  const visibleItems = useMemo(
    () =>
      applyWardrobeFilters(activeItems, itemFilters).filter((item) =>
        matchesWardrobeSearch(item, itemQuery, categories, catalogs)
      ),
    [activeItems, catalogs, categories, itemFilters, itemQuery]
  );
  const selectedItems = useMemo(
    () => (draft?.itemIds ?? []).map((id) => itemById[id]).filter(Boolean),
    [draft?.itemIds, itemById]
  );
  const activeItemFilterCount = useMemo(() => countFilters(itemFilters), [itemFilters]);
  const selectedStyle = draft?.tags?.[0] ?? "";
  const selectedCustomStyle =
    selectedStyle &&
    !styleOptions.some((style) => normalizeStyleName(style) === normalizeStyleName(selectedStyle))
      ? selectedStyle
      : "";
  const pendingCollectionTitles = draft?.pendingCollectionTitles ?? [];

  useEffect(() => {
    const shouldAutoOpen = route.params?.openCoverEditorOnMount || route.params?.focusCover;
    if (!shouldAutoOpen || !draft || !draftSessionId || autoOpenCoverHandledRef.current) return;

    autoOpenCoverHandledRef.current = true;
    handleOpenCoverEditor();
  }, [draft, draftSessionId, route.params?.focusCover, route.params?.openCoverEditorOnMount]);

  useEffect(() => {
    if ((draft?.itemIds ?? []).length >= 2 && coverImagesError === OUTFIT_MIN_ITEMS_MESSAGE) {
      setCoverImagesError("");
    }
  }, [coverImagesError, draft?.itemIds]);

  const setDraft = (patch) => actions.updateOutfitDraftSession(draftSessionId, patch);

  function toggleSeason(season) {
    const current = draft.season ?? [];
    const next = current.includes(season)
      ? current.filter((entry) => entry !== season)
      : [...current, season];
    setDraft({ season: next });
  }

  function toggleCollection(collectionId) {
    const current = draft.collectionIds ?? [];
    const next = current.includes(collectionId)
      ? current.filter((entry) => entry !== collectionId)
      : [...current, collectionId];
    setDraft({ collectionIds: next });
  }

  function toggleStyle(style) {
    const current = draft.tags?.[0];
    setDraft({
      tags: current && normalizeStyleName(current) === normalizeStyleName(style) ? [] : [style],
      styleInput: "",
    });
  }

  function toggleItem(itemId) {
    const nextItemIds = (draft.itemIds ?? []).includes(itemId)
      ? draft.itemIds.filter((entry) => entry !== itemId)
      : [...(draft.itemIds ?? []), itemId];

    setDraft({
      itemIds: nextItemIds,
      coverEditorStateJson: syncCoverStateWithItems(
        draft.coverMode,
        draft.coverEditorStateJson,
        nextItemIds,
        itemById
      ),
    });
  }

  function commitTypedStyle() {
    const rawInput = String(draft?.styleInput ?? "").trim();
    if (!rawInput) return;

    const normalizedInput = normalizeStyleName(rawInput);
    const resolvedStyle =
      styleOptions.find((style) => normalizeStyleName(style) === normalizedInput) ?? rawInput;

    setDraft({
      tags: resolvedStyle ? [resolvedStyle] : [],
      styleInput: "",
    });
  }

  function removeCustomStyle() {
    setDraft({ tags: [], styleInput: "" });
  }

  function commitTypedCollection() {
    const rawInput = String(draft?.collectionInput ?? "").trim();
    if (!rawInput) return;

    const existingCollection = resolveExistingCollection(outfitCollections, rawInput);
    const nextCollectionIds = uniqueValues([...(draft.collectionIds ?? []), existingCollection?.id]);

    if (existingCollection) {
      setDraft({
        collectionIds: nextCollectionIds,
        collectionInput: "",
      });
      return;
    }

    const normalizedInput = normalizeOutfitSelectableName(rawInput);
    const nextPendingTitles = uniqueValues([
      ...pendingCollectionTitles.filter(
        (title) => normalizeOutfitSelectableName(title) !== normalizedInput
      ),
      rawInput,
    ]);

    setDraft({
      pendingCollectionTitles: nextPendingTitles,
      collectionInput: "",
    });
  }

  function removePendingCollection(title) {
    const normalizedTitle = normalizeOutfitSelectableName(title);
    setDraft({
      pendingCollectionTitles: pendingCollectionTitles.filter(
        (entry) => normalizeOutfitSelectableName(entry) !== normalizedTitle
      ),
    });
  }

  async function handleOpenCoverEditor() {
    if (preparingCoverImages) return;
    setPreparingCoverImages(true);

    try {
      await openOutfitCoverEditor({
        navigation,
        actions,
        draftSessionId,
        draft,
        itemById,
      });
      setCoverImagesError("");
    } catch (error) {
      const message = error.message || "";
      setCoverImagesError(message);
      Alert.alert("Обложка", message || "Не удалось открыть редактор обложки.");
    } finally {
      setPreparingCoverImages(false);
    }
  }

  const onSave = React.useCallback(async () => {
    if (!draft) {
      return;
    }

    const title = (draft.title ?? "").trim();
    if (!title) {
      Alert.alert("Название", "Введите название образа.");
      return;
    }

    const rawStyleInput = String(draft.styleInput ?? "").trim();
    const preparedStyle =
      rawStyleInput &&
      (styleOptions.find(
        (style) => normalizeStyleName(style) === normalizeStyleName(rawStyleInput)
      ) ?? rawStyleInput);

    const rawCollectionInput = String(draft.collectionInput ?? "").trim();
    const preparedDraft = {
      ...draft,
      tags: preparedStyle ? [preparedStyle] : draft.tags ?? [],
      styleInput: "",
      pendingCollectionTitles: pendingCollectionTitles.slice(),
      collectionInput: "",
    };

    if (rawCollectionInput) {
      const matchedCollection = resolveExistingCollection(outfitCollections, rawCollectionInput);
      if (matchedCollection) {
        preparedDraft.collectionIds = uniqueValues([
          ...(preparedDraft.collectionIds ?? []),
          matchedCollection.id,
        ]);
      } else {
        preparedDraft.pendingCollectionTitles = uniqueValues([
          ...preparedDraft.pendingCollectionTitles.filter(
            (entry) =>
              normalizeOutfitSelectableName(entry) !==
              normalizeOutfitSelectableName(rawCollectionInput)
          ),
          rawCollectionInput,
        ]);
      }
    }

    if ((preparedDraft.itemIds ?? []).length < 2) {
      Alert.alert("Образ", OUTFIT_MIN_ITEMS_MESSAGE);
      return;
    }

    const syncedCoverState = syncCoverStateWithItems(
      preparedDraft.coverMode,
      preparedDraft.coverEditorStateJson,
      preparedDraft.itemIds,
      itemById
    );

    setSaving(true);
    try {
      const createdCollections = [];
      for (const titleToCreate of preparedDraft.pendingCollectionTitles ?? []) {
        const existingCollection = resolveExistingCollection(outfitCollections, titleToCreate);
        if (existingCollection) {
          createdCollections.push(existingCollection);
          continue;
        }

        const savedCollection = await actions.addOutfitCollection(titleToCreate);
        createdCollections.push(savedCollection);
      }

      const finalCollectionIds = uniqueValues([
        ...(preparedDraft.collectionIds ?? []),
        ...createdCollections.map((collection) => collection.id),
      ]);

      setDraft({
        tags: preparedDraft.tags,
        styleInput: "",
        collectionInput: "",
        pendingCollectionTitles: [],
        collectionIds: finalCollectionIds,
      });

      await actions.upsertOutfit({
        ...preparedDraft,
        title,
        description: preparedDraft.description ?? "",
        tags: (preparedDraft.tags ?? []).slice(0, 1),
        collectionIds: finalCollectionIds,
        coverEditorStateJson: syncedCoverState,
      });

      draftSavedRef.current = true;
      actions.clearOutfitDraftSession(draftSessionId);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Не удалось сохранить", error.message || "Попробуйте ещё раз");
    } finally {
      setSaving(false);
    }
  }, [
    actions,
    draft,
    draftSessionId,
    itemById,
    navigation,
    outfitCollections,
    pendingCollectionTitles,
    styleOptions,
  ]);

  const saveButtonDisabled = !draftSessionId || !draft || saving || preparingCoverImages;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: existing ? "Редактировать образ" : "Новый образ",
      headerRight: () => (
        <Pressable
          onPress={onSave}
          disabled={saveButtonDisabled}
          hitSlop={8}
          style={({ pressed }) => ({
            backgroundColor: "#111111",
            borderRadius: radius.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: 8,
            opacity: saveButtonDisabled ? 0.45 : pressed ? 0.6 : 1,
          })}
        >
          <Text style={[typography.button, { color: "#FFFFFF" }]}>
            {saving ? "Сохраняем..." : "Сохранить"}
          </Text>
        </Pressable>
      ),
    });
  }, [existing, navigation, onSave, radius.pill, saveButtonDisabled, saving, spacing.md, typography.button]);

  if (!draftSessionId || !draft) {
    return (
      <Screen padded>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.md }]}>
          Подготавливаем редактор образа...
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll padded withKeyboard>
      <View
        style={{
          borderRadius: radius.xl,
          backgroundColor: colors.secondaryBackground,
          padding: spacing.md,
          marginTop: spacing.xs,
        }}
      >
        <Text style={[typography.cardTitle, { color: colors.text }]}>Обложка образа</Text>
        <OutfitCoverPreview draft={draft} previewItems={selectedItems} />
        {!draft.coverFileId && draft.coverMode === "none" ? (
          <Text style={[typography.caption, { color: colors.secondaryText, marginTop: spacing.xs }]}>
            Сначала выберите минимум 2 вещи, затем можно собрать обложку.
          </Text>
        ) : null}
      </View>

      <View style={{ marginTop: spacing.sm }}>
        <ActionButton
          label="Редактировать обложку"
          icon="image-outline"
          variant="secondary"
          onPress={handleOpenCoverEditor}
          disabled={preparingCoverImages}
          fullWidth
        />
      </View>
      {coverImagesError ? (
        <Text style={[typography.caption, { color: colors.danger, marginTop: spacing.xs }]}>
          {coverImagesError}
        </Text>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Основные поля" />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.sm }]}>
          Название
        </Text>
        <Input
          value={draft.title}
          onChangeText={(value) => setDraft({ title: value })}
          placeholder="Например, На учебу"
          style={{ marginTop: 6 }}
        />

        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>
          Сезон
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {seasonOptions.map((season) => (
            <Chip
              key={season}
              label={season}
              selected={(draft.season ?? []).includes(season)}
              onPress={() => toggleSeason(season)}
            />
          ))}
        </View>

        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>
          Стиль
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {styleOptions.map((style) => (
            <Chip
              key={style}
              label={style}
              selected={
                Boolean(selectedStyle) &&
                normalizeStyleName(selectedStyle) === normalizeStyleName(style)
              }
              onPress={() => toggleStyle(style)}
            />
          ))}
          {selectedCustomStyle ? (
            <Chip label={selectedCustomStyle} selected onPress={removeCustomStyle} />
          ) : null}
        </View>
        <Input
          value={draft.styleInput ?? ""}
          onChangeText={(value) => setDraft({ styleInput: value })}
          onSubmitEditing={commitTypedStyle}
          onBlur={commitTypedStyle}
          placeholder="Введите или выберите стиль"
          returnKeyType="done"
          style={{ marginTop: spacing.sm }}
        />

        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>
          Подборки
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {outfitCollections.map((collection) => (
            <Chip
              key={collection.id}
              label={collection.title}
              selected={(draft.collectionIds ?? []).includes(collection.id)}
              onPress={() => toggleCollection(collection.id)}
            />
          ))}
          {pendingCollectionTitles.map((title) => (
            <Chip key={title} label={title} selected onPress={() => removePendingCollection(title)} />
          ))}
        </View>
        <Input
          value={draft.collectionInput ?? ""}
          onChangeText={(value) => setDraft({ collectionInput: value })}
          onSubmitEditing={commitTypedCollection}
          onBlur={commitTypedCollection}
          placeholder="Введите новую подборку"
          returnKeyType="done"
          style={{ marginTop: spacing.sm }}
        />
        {!outfitCollections.length && !pendingCollectionTitles.length ? (
          <Text style={[typography.caption, { color: colors.secondaryText, marginTop: spacing.sm }]}>
            Можно сохранить образ и без подборки.
          </Text>
        ) : null}

        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>
          Описание
        </Text>
        <Input
          value={draft.description}
          onChangeText={(value) => setDraft({ description: value })}
          placeholder="Короткое описание образа"
          multiline
          style={{ marginTop: 6 }}
        />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Состав образа" />
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.sm }]}>
          Выбрано {formatOutfitItemCount(selectedItems.length)} / минимум 2
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.sm }}
        >
          {selectedItems.length ? (
            selectedItems.map((item) => (
              <SelectedItemCard
                key={item.id}
                item={item}
                category={categoriesById[item.categoryId]}
                onRemove={() => toggleItem(item.id)}
              />
            ))
          ) : (
            <View
              style={{
                width: 220,
                padding: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBackground,
              }}
            >
              <Text style={[typography.body, { color: colors.secondaryText }]}>
                Выберите минимум две вещи для сохранения и обложки.
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <SearchBar
              value={itemQuery}
              onChangeText={setItemQuery}
              onClear={() => setItemQuery("")}
              placeholder="Найти вещь"
            />
          </View>
          <ActionButton
            icon="options-outline"
            compact
            variant="secondary"
            label={activeItemFilterCount ? String(activeItemFilterCount) : undefined}
            onPress={() => setItemFiltersVisible(true)}
          />
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
          {visibleItems.map((item) => (
            <View key={item.id} style={{ width: "48%" }}>
              <WardrobeItemCard
                item={item}
                category={categoriesById[item.categoryId]}
                onPress={() => toggleItem(item.id)}
                selectionMode
                selected={(draft.itemIds ?? []).includes(item.id)}
              />
            </View>
          ))}
        </View>

        {!visibleItems.length ? (
          <View
            style={{
              marginTop: spacing.md,
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: colors.secondaryBackground,
            }}
          >
            <Text style={[typography.body, { color: colors.secondaryText }]}>
              Ничего не найдено. Попробуйте изменить запрос или фильтры.
            </Text>
          </View>
        ) : null}
      </View>

      <WardrobeFiltersSheet
        visible={itemFiltersVisible}
        onClose={() => setItemFiltersVisible(false)}
        filters={itemFilters}
        onChangeFilters={setItemFilters}
        catalogs={catalogs}
        categories={categories}
        options={itemFilterOptions}
        showOutfitParticipation={false}
      />

      <Modal visible={preparingCoverImages} transparent animationType="fade" onRequestClose={() => null}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(17,17,17,0.28)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.lg,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 340,
              borderRadius: radius.xl,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.lg,
              alignItems: "center",
            }}
          >
            <ActivityIndicator size="small" color={colors.text} />
            <Text style={[typography.sectionTitle, { color: colors.text, marginTop: spacing.sm }]}>
              Подготавливаем изображения...
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.secondaryText, marginTop: 6, textAlign: "center" },
              ]}
            >
              Загружаем вещи для редактора обложки
            </Text>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
