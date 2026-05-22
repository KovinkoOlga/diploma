import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import Screen from "../../components/Screen";
import ActionButton from "../../components/ActionButton";
import WardrobeItemForm from "../../components/WardrobeItemForm";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";
import { createDraftFromItem, finalizeDraftStyleInput, normalizeWardrobeItemDraft } from "../../utils/wardrobe";

function imageSourceForOption(option) {
  return option?.imageUrl ? { uri: option.imageUrl } : undefined;
}

export default function WardrobeConfirmItemScreen({ navigation, route }) {
  const { spacing } = useAppTheme();
  const { catalogs, categories, colorOptions, seasonOptions, styleOptions, statusOptions, items, actions } = useWardrobe();
  const existingItem = useMemo(() => items.find((item) => item.id === route.params?.itemId), [items, route.params?.itemId]);
  const isEditMode = Boolean(existingItem);
  const draftId = route.params?.draftId;
  const [titleFocused, setTitleFocused] = useState(false);

  const normalizeDraft = useCallback(
    (nextDraft, previousDraft) =>
      normalizeWardrobeItemDraft(nextDraft, previousDraft, colorOptions, {
        seasonOptions,
        statusOptions,
        suppressAutoTitle: titleFocused,
      }),
    [colorOptions, seasonOptions, statusOptions, titleFocused]
  );

  const [saving, setSaving] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [draftState, setDraftState] = useState(null);
  const [draft, setDraft] = useState(() =>
    normalizeDraft(
      route.params?.draft ?? createDraftFromItem(existingItem ?? {}, colorOptions, { seasonOptions, statusOptions }),
      existingItem
    )
  );

  const updateDraft = useCallback(
    (nextDraft) => {
      setDraft((current) => normalizeDraft(typeof nextDraft === "function" ? nextDraft(current) : nextDraft, current));
    },
    [normalizeDraft]
  );

  const syncDraftState = useCallback(
    (next) => {
      setDraftState(next);
      if (!next?.draft) return;

      setDraft((current) => {
        const normalized = normalizeDraft(next.draft, current);
        const optionIds = [next.images?.cutout?.fileId, next.images?.catalog?.fileId].filter(Boolean);
        const currentSelectionIsValid = current.primaryImageFileId && optionIds.includes(current.primaryImageFileId);
        const selectedPrimaryImageId = currentSelectionIsValid ? current.primaryImageFileId : normalized.primaryImageFileId;
        let selectedImage = currentSelectionIsValid ? current.image ?? normalized.image : normalized.image;

        if (selectedPrimaryImageId && next.images?.catalog?.fileId === selectedPrimaryImageId) {
          selectedImage = imageSourceForOption(next.images.catalog) ?? selectedImage;
        } else if (selectedPrimaryImageId && next.images?.cutout?.fileId === selectedPrimaryImageId) {
          selectedImage = imageSourceForOption(next.images.cutout) ?? selectedImage;
        }

        return normalizeDraft(
          {
            ...normalized,
            ...current,
            primaryImageFileId: selectedPrimaryImageId,
            image: selectedImage,
          },
          current
        );
      });
    },
    [normalizeDraft]
  );

  useEffect(() => {
    setDraft((current) => normalizeDraft(current, current));
  }, [normalizeDraft]);

  useEffect(() => {
    if (!existingItem || draftId) return;
    setDraft(normalizeDraft(createDraftFromItem(existingItem, colorOptions, { seasonOptions, statusOptions }), existingItem));
  }, [colorOptions, draftId, existingItem, normalizeDraft, seasonOptions, statusOptions]);

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
  }, [actions, draftId, route.params?.maskEditedAt, syncDraftState]);

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
    const preparedDraft = finalizeDraftStyleInput(draft, styleOptions);
    setDraft((current) => normalizeDraft(preparedDraft, current));

    if (existingItem) {
      const updated = await actions.updateItem(existingItem.id, preparedDraft);
      return updated ?? { ...existingItem, ...preparedDraft };
    }

    if (draftId) {
      return actions.confirmDraft(draftId, preparedDraft);
    }

    return actions.addItem(preparedDraft);
  };

  return (
    <Screen scroll padded withKeyboard>
      <View>
        <WardrobeItemForm
          draft={draft}
          onChange={updateDraft}
          catalogs={catalogs}
          categories={categories}
          colorOptions={colorOptions}
          seasonOptions={seasonOptions}
          styleOptions={styleOptions}
          statusOptions={statusOptions}
          draftImages={draftState?.images}
          catalogProcessingStatus={draftState?.catalogProcessingStatus}
          catalogErrorMessage={draftState?.catalogErrorMessage}
          onSelectImageOption={(imageOption) =>
            updateDraft((current) => ({
              ...current,
              primaryImageFileId: imageOption.fileId,
              image: imageSourceForOption(imageOption) ?? current.image,
            }))
          }
          onEditMask={
            draftId &&
            draft.sourceType !== "catalog" &&
            draftState?.images?.cutout &&
            (draftState?.originalImagePreviewDataUrl || draftState?.originalImageUrl) &&
            draftState?.maskBitmap?.dataBase64
              ? () =>
                  actions.fetchDraft(draftId).then((latestDraftState) => {
                    syncDraftState(latestDraftState);
                    navigation.push(Routes.WardrobeMaskEditor, {
                      draftId,
                      editorOpenedAt: Date.now(),
                      cutoutImageUrl: latestDraftState.images?.cutout?.imageUrl ?? draftState.images.cutout.imageUrl,
                      maskImageUrl: latestDraftState.maskImageUrl ?? draftState.maskImageUrl,
                      maskBitmap: latestDraftState.maskBitmap ?? draftState.maskBitmap,
                      originalImagePreviewDataUrl:
                        latestDraftState.originalImagePreviewDataUrl ?? draftState.originalImagePreviewDataUrl,
                      originalImageUrl: latestDraftState.originalImageUrl ?? draftState.originalImageUrl,
                    });
                  })
              : undefined
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
          onTitleFocus={() => setTitleFocused(true)}
          onTitleBlur={() => {
            setTitleFocused(false);
            setDraft((current) =>
              normalizeWardrobeItemDraft(current, current, colorOptions, {
                seasonOptions,
                statusOptions,
                suppressAutoTitle: false,
              })
            );
          }}
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
                  { name: Routes.WardrobeItemDetails, params: { itemId: saved.id } },
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
