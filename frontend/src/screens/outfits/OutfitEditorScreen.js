import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Input from "../../components/Input";
import Chip from "../../components/Chip";
import SectionHeader from "../../components/SectionHeader";
import ActionButton from "../../components/ActionButton";
import OutfitCoverPreview from "../../components/OutfitCoverPreview";
import OutfitCoverModeSheet from "../../components/OutfitCoverModeSheet";
import MediaPreview from "../../components/MediaPreview";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";
import {
  createBaseCoverEditorState,
  defaultOutfitDraft,
  syncCoverStateWithItems,
} from "../../utils/outfitCover";
import { preloadOutfitCoverImages } from "../../utils/preloadOutfitImages";

const tagOptions = ["casual", "office", "sport", "classic", "warm", "evening"];

export default function OutfitEditorScreen({ navigation, route }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { outfits, items, seasonOptions, outfitDraftSessions, actions } = useWardrobe();
  const existing = useMemo(
    () => outfits.find((entry) => entry.id === route.params?.outfitId),
    [outfits, route.params?.outfitId]
  );
  const seedItemId = route.params?.seedItemId;
  const [draftSessionId, setDraftSessionId] = useState(() => route.params?.draftSessionId ?? null);
  const [saving, setSaving] = useState(false);
  const [coverSheetVisible, setCoverSheetVisible] = useState(false);
  const [preparingCoverImages, setPreparingCoverImages] = useState(false);
  const [coverImagesError, setCoverImagesError] = useState(null);

  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  useEffect(() => {
    if (draftSessionId) return;
    const nextSessionId = actions.createOutfitDraftSession(defaultOutfitDraft(existing, seedItemId));
    setDraftSessionId(nextSessionId);
  }, [actions, draftSessionId, existing, seedItemId]);

  const draft = draftSessionId ? outfitDraftSessions[draftSessionId] || defaultOutfitDraft(existing, seedItemId) : null;

  useEffect(() => {
    if (route.params?.focusCover) {
      setCoverSheetVisible(true);
    }
  }, [route.params?.focusCover]);

  const selectedItems = useMemo(
    () => (draft?.itemIds ?? []).map((id) => itemById[id]).filter(Boolean),
    [draft?.itemIds, itemById]
  );

  if (!draftSessionId || !draft) {
    return (
      <Screen padded>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.md }]}>
          Подготавливаем редактор образа...
        </Text>
      </Screen>
    );
  }

  const setDraft = (patch) => actions.updateOutfitDraftSession(draftSessionId, patch);

  const toggle = (field, value) => {
    const current = draft[field] ?? [];
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    setDraft({ [field]: next });
  };

  const toggleItem = (itemId) => {
    const nextItemIds = (draft.itemIds ?? []).includes(itemId)
      ? draft.itemIds.filter((entry) => entry !== itemId)
      : [...(draft.itemIds ?? []), itemId];

    const nextCoverState = syncCoverStateWithItems(
      draft.coverMode,
      draft.coverEditorStateJson,
      nextItemIds,
      itemById
    );

    setDraft({
      itemIds: nextItemIds,
      coverEditorStateJson: nextCoverState,
    });
  };

  const onComposeCover = async () => {
    if (preparingCoverImages) return;
    setCoverSheetVisible(false);
    setCoverImagesError(null);
    setPreparingCoverImages(true);

    const selectedItemIds = (draft.itemIds ?? []).filter(Boolean);
    const selectedItemsForCover = selectedItemIds.map((itemId) => itemById[itemId]).filter(Boolean);

    try {
      const { failedItems } = await preloadOutfitCoverImages(selectedItemsForCover, { timeoutMs: 12000 });

      if (failedItems.length) {
        if (__DEV__) {
          console.warn("[OutfitCover] Failed to preload item images", failedItems);
        }
        setCoverImagesError("Не удалось подготовить изображения для обложки.");
        Alert.alert(
          "Обложка",
          "Не удалось подготовить изображения для обложки. Проверьте подключение и попробуйте снова."
        );
        return;
      }

      const coverState = createBaseCoverEditorState(
        draft.itemIds ?? [],
        itemById,
        draft.coverEditorStateJson
      );
      setDraft({
        coverMode: "composition",
        coverEditorStateJson: coverState,
      });
      navigation.navigate(Routes.OutfitCoverEditor, { draftSessionId });
    } catch (error) {
      if (__DEV__) {
        console.warn("[OutfitCover] Image preload failed with error", error);
      }
      setCoverImagesError("Не удалось подготовить изображения для обложки.");
      Alert.alert(
        "Обложка",
        "Не удалось подготовить изображения для обложки. Проверьте подключение и попробуйте снова."
      );
    } finally {
      setPreparingCoverImages(false);
    }
  };

  const onSave = async () => {
    if ((draft.title ?? "").trim().length < 2) {
      Alert.alert("Название", "Введите название образа.");
      return;
    }

    if ((draft.itemIds ?? []).length === 0) {
      Alert.alert("Вещи", "Добавьте хотя бы одну вещь в образ.");
      return;
    }

    const syncedCoverState = syncCoverStateWithItems(
      draft.coverMode,
      draft.coverEditorStateJson,
      draft.itemIds,
      itemById
    );

    setSaving(true);
    try {
      await actions.upsertOutfit({
        ...draft,
        title: draft.title.trim(),
        description: draft.description ?? "",
        tags: (draft.tags ?? []).slice(0, 1),
        coverEditorStateJson: syncedCoverState,
      });
      actions.clearOutfitDraftSession(draftSessionId);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll padded withKeyboard>
      <View style={{ marginTop: spacing.xs }}>
        <SectionHeader title="Название" />
        <Input
          value={draft.title}
          onChangeText={(value) => setDraft({ title: value })}
          placeholder="Например, На учебу"
          style={{ marginTop: spacing.sm }}
        />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Метаинформация" />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.sm }]}>Описание</Text>
        <Input
          value={draft.description}
          onChangeText={(value) => setDraft({ description: value })}
          placeholder="Короткое описание образа"
          multiline
          style={{ marginTop: 6 }}
        />

        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Сезон</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {seasonOptions.map((season) => (
            <Chip key={season} label={season} selected={(draft.season ?? []).includes(season)} onPress={() => toggle("season", season)} />
          ))}
        </View>

        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Стиль</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {tagOptions.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              selected={(draft.tags ?? []).includes(tag)}
              onPress={() => setDraft({ tags: [tag] })}
            />
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Выбор вещей" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
          {items.map((item) => {
            const selected = (draft.itemIds ?? []).includes(item.id);

            return (
              <Pressable
                key={item.id}
                onPress={() => toggleItem(item.id)}
                style={({ pressed }) => [{ width: "48%", opacity: pressed ? 0.85 : 1 }]}
              >
                <View
                  style={{
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: selected ? colors.text : colors.divider,
                    padding: spacing.sm,
                  }}
                >
                  <MediaPreview
                    source={item.image}
                    placeholderScale={0.5}
                    containerStyle={{
                      width: "100%",
                      aspectRatio: 0.85,
                      borderRadius: radius.md,
                      backgroundColor: colors.secondaryBackground,
                    }}
                  />
                  <Text style={[typography.cardTitle, { color: colors.text, marginTop: 10 }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 4 }]} numberOfLines={1}>
                    {[item.subcategory, item.brand].filter(Boolean).join(" · ") || "Вещь"}
                  </Text>
                  <ActionButton
                    label={selected ? "Убрать" : "Добавить"}
                    variant={selected ? "primary" : "secondary"}
                    onPress={() => toggleItem(item.id)}
                    style={{ marginTop: spacing.sm }}
                    fullWidth
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={{
          borderRadius: radius.xl,
          backgroundColor: colors.secondaryBackground,
          padding: spacing.md,
          marginTop: spacing.lg,
        }}
      >
        <Text style={[typography.cardTitle, { color: colors.text }]}>Обложка образа</Text>
        <OutfitCoverPreview draft={draft} previewItems={selectedItems} />
        <View style={{ marginTop: spacing.sm }}>
          <ActionButton
            label="Создать/изменить обложку"
            icon="image-outline"
            variant="secondary"
            onPress={() => setCoverSheetVisible(true)}
            disabled={preparingCoverImages}
            fullWidth
          />
          {coverImagesError ? (
            <Text style={[typography.caption, { color: colors.danger, marginTop: spacing.xs }]}>
              {coverImagesError}
            </Text>
          ) : null}
        </View>
      </View>

      <ActionButton
        label={saving ? "Сохраняем..." : existing ? "Сохранить изменения" : "Сохранить образ"}
        icon="checkmark-outline"
        onPress={onSave}
        disabled={saving || preparingCoverImages}
        style={{ marginTop: spacing.lg }}
        fullWidth
      />

      <ActionButton
        label="Отмена"
        icon="close-outline"
        variant="secondary"
        onPress={() => {
          actions.clearOutfitDraftSession(draftSessionId);
          navigation.goBack();
        }}
        disabled={preparingCoverImages}
        style={{ marginTop: spacing.sm }}
        fullWidth
      />

      <OutfitCoverModeSheet
        visible={coverSheetVisible}
        onClose={() => {
          if (preparingCoverImages) return;
          setCoverSheetVisible(false);
        }}
        onSelectComposition={onComposeCover}
        disabled={preparingCoverImages}
        onClear={() => {
          if (preparingCoverImages) return;
          setCoverSheetVisible(false);
          setDraft({
            coverMode: "none",
            coverFileId: null,
            coverImageUrl: null,
            coverTransparentImageUrl: null,
            coverImage: null,
            coverTransparentImage: null,
            coverEditorStateJson: null,
          });
        }}
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
              Подготавливаем изображения…
            </Text>
            <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 6, textAlign: "center" }]}>
              Загружаем вещи для редактора обложки
            </Text>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
