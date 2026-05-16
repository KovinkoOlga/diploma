import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import ActionButton from "../../components/ActionButton";
import WardrobeItemForm from "../../components/WardrobeItemForm";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";
import { createDraftFromItem, normalizeWardrobeItemDraft } from "../../utils/wardrobe";

function imageSourceForOption(option) {
  return option?.imageUrl ? { uri: option.imageUrl } : undefined;
}

export default function WardrobeConfirmItemScreen({ navigation, route }) {
  const { typography, colors, spacing } = useAppTheme();
  const { catalogs, categories, items, actions } = useWardrobe();
  const existingItem = useMemo(() => items.find((item) => item.id === route.params?.itemId), [items, route.params?.itemId]);
  const isEditMode = Boolean(existingItem);
  const draftId = route.params?.draftId;

  const [saving, setSaving] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [draftState, setDraftState] = useState(null);
  const [draft, setDraft] = useState(
    normalizeWardrobeItemDraft(route.params?.draft ?? createDraftFromItem(existingItem ?? {}), existingItem)
  );

  const syncDraftState = (next) => {
    setDraftState(next);
    if (!next?.draft) return;

    setDraft((current) => {
      const normalized = normalizeWardrobeItemDraft(next.draft, current);
      const selectedPrimaryImageId = current.primaryImageFileId ?? normalized.primaryImageFileId;
      let selectedImage = current.image ?? normalized.image;

      if (selectedPrimaryImageId && next.images?.catalog?.fileId === selectedPrimaryImageId) {
        selectedImage = imageSourceForOption(next.images.catalog) ?? selectedImage;
      } else if (selectedPrimaryImageId && next.images?.cutout?.fileId === selectedPrimaryImageId) {
        selectedImage = imageSourceForOption(next.images.cutout) ?? selectedImage;
      }

      return {
        ...normalized,
        ...current,
        primaryImageFileId: selectedPrimaryImageId,
        image: selectedImage,
      };
    });
  };

  useEffect(() => {
    let alive = true;

    async function loadDraft() {
      if (!draftId) return;
      try {
        const next = await actions.fetchDraft(draftId);
        if (!alive) return;
        syncDraftState(next);
      } catch {
        return;
      }
    }

    loadDraft();
    return () => {
      alive = false;
    };
  }, [actions, draftId]);

  const pollCatalogStatus = async () => {
    if (!draftId) return;
    try {
      const next = await actions.fetchDraft(draftId);
      syncDraftState(next);
      if (next.catalogProcessingStatus === "queued" || next.catalogProcessingStatus === "processing") {
        setTimeout(() => {
          pollCatalogStatus();
        }, 900);
        return;
      }
      setEnhancing(false);
    } catch (error) {
      setDraftState((current) =>
        current
          ? { ...current, catalogErrorMessage: error?.message || "Не удалось получить статус обработки" }
          : { catalogErrorMessage: error?.message || "Не удалось получить статус обработки" }
      );
      setEnhancing(false);
    }
  };

  const saveDraft = async () => {
    if (existingItem) {
      const updated = await actions.updateItem(existingItem.id, draft);
      return updated ?? { ...existingItem, ...draft };
    }

    if (draftId) {
      return actions.confirmDraft(draftId, draft);
    }

    return actions.addItem(draft);
  };

  return (
    <Screen scroll padded withKeyboard>
      <Text style={[typography.h2, { color: colors.text }]}>
        {isEditMode ? "Редактирование вещи" : "Подтвердите карточку вещи"}
      </Text>
      <Text style={[typography.body, { color: colors.secondaryText, marginTop: 8 }]}>
        {isEditMode
          ? "Изменения вносятся прямо на этом экране без отдельного шага редактирования."
          : "Моковые атрибуты уже подставлены. Их можно сразу скорректировать на этом экране и сохранить в шкаф."}
      </Text>

      <View style={{ marginTop: spacing.lg }}>
        <WardrobeItemForm
          draft={draft}
          onChange={setDraft}
          catalogs={catalogs}
          categories={categories}
          draftImages={draftState?.images}
          catalogProcessingStatus={draftState?.catalogProcessingStatus}
          catalogErrorMessage={draftState?.catalogErrorMessage}
          onSelectImageOption={(imageOption) =>
            setDraft((current) => ({
              ...current,
              primaryImageFileId: imageOption.fileId,
              image: imageSourceForOption(imageOption) ?? current.image,
            }))
          }
          onEnhancePhoto={
            draftId && draft.sourceType !== "catalog"
              ? async () => {
                  let keepPolling = false;
                  setEnhancing(true);
                  try {
                    const next = await actions.enhanceDraft(draftId);
                    syncDraftState(next);
                    if (next.catalogProcessingStatus === "queued" || next.catalogProcessingStatus === "processing") {
                      keepPolling = true;
                      await pollCatalogStatus();
                      return;
                    }
                  } catch (error) {
                    setDraftState((current) =>
                      current
                        ? { ...current, catalogErrorMessage: error?.message || "Не удалось улучшить фото" }
                        : { catalogErrorMessage: error?.message || "Не удалось улучшить фото" }
                    );
                  } finally {
                    if (!keepPolling) {
                      setEnhancing(false);
                    }
                  }
                }
              : undefined
          }
          enhanceBusy={enhancing}
        />
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <ActionButton
          label={saving ? "Сохраняем..." : "Сохранить"}
          icon="checkmark-outline"
          disabled={saving}
          onPress={async () => {
            setSaving(true);
            try {
              const saved = await saveDraft();

              if (isEditMode) {
                navigation.goBack();
                return;
              }

              navigation.reset({
                index: 1,
                routes: [
                  { name: Routes.WardrobeHome },
                  { name: Routes.ItemDetails, params: { itemId: saved.id } },
                ],
              });
            } finally {
              setSaving(false);
            }
          }}
          fullWidth
        />
        <ActionButton
          label="Отменить"
          icon="close-outline"
          variant="secondary"
          onPress={() => navigation.goBack()}
          fullWidth
        />
      </View>
    </Screen>
  );
}
