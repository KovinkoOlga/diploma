import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import Screen from "../../components/Screen";
import ActionButton from "../../components/ActionButton";
import WardrobeItemForm from "../../components/WardrobeItemForm";
import { Routes } from "../../navigation/routes";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAppTheme } from "../../theme/ThemeProvider";
import {
  createDraftFromItem,
  finalizeDraftStyleInput,
  getWardrobeDraftValidationMessage,
  normalizeWardrobeItemDraft,
} from "../../utils/wardrobe";
import {
  getPhotoBatchCurrentEntry,
  getPhotoBatchEntry,
  getPhotoBatchProgress,
  isPhotoBatchEntryReady,
} from "../../utils/wardrobePhotoBatch";

function imageSourceForOption(option) {
  return option?.imageUrl ? { uri: option.imageUrl } : undefined;
}

const PRESERVED_DRAFT_FIELDS = [
  "title",
  "catalogId",
  "categoryId",
  "subcategory",
  "colorIds",
  "seasons",
  "styles",
  "brand",
  "notes",
  "status",
  "primaryImageFileId",
  "styleInput",
];

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return left === right;
  }
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function valuesEqual(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return arraysEqual(left ?? [], right ?? []);
  }
  return left === right;
}

function preserveEditedDraftFields(currentDraft, previousServerDraft, nextServerDraft) {
  if (!previousServerDraft) return nextServerDraft;

  const mergedDraft = { ...nextServerDraft };
  for (const field of PRESERVED_DRAFT_FIELDS) {
    if (!valuesEqual(currentDraft?.[field], previousServerDraft?.[field])) {
      mergedDraft[field] = currentDraft?.[field];
    }
  }
  return mergedDraft;
}

export default function WardrobeConfirmItemScreen({ navigation, route }) {
  const { spacing, colors, typography, radius } = useAppTheme();
  const { catalogs, categories, colorOptions, seasonOptions, styleOptions, statusOptions, items, photoBatch, actions } =
    useWardrobe();
  const existingItem = useMemo(() => items.find((item) => item.id === route.params?.itemId), [items, route.params?.itemId]);
  const isEditMode = Boolean(existingItem);
  const draftId = route.params?.draftId;
  const batchId = route.params?.batchId;
  const requestedEntryId = route.params?.entryId ?? null;
  const isBatchMode = Boolean(batchId);
  const batch = isBatchMode && photoBatch?.batchId === batchId ? photoBatch : null;
  const currentEntry = useMemo(() => {
    if (!batch) return null;
    if (requestedEntryId) {
      return getPhotoBatchEntry(batch, requestedEntryId) ?? getPhotoBatchCurrentEntry(batch);
    }
    return getPhotoBatchCurrentEntry(batch);
  }, [batch, requestedEntryId]);
  const currentEntryId = currentEntry?.id ?? null;
  const currentProgress = useMemo(() => getPhotoBatchProgress(batch, currentEntryId), [batch, currentEntryId]);
  const draftStateRef = useRef(null);
  const allowRemoveRef = useRef(false);
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
  const normalizeIncomingDraft = useCallback(
    (nextDraft) => normalizeWardrobeItemDraft(nextDraft, existingItem ?? {}, colorOptions, { seasonOptions, statusOptions }),
    [colorOptions, existingItem, seasonOptions, statusOptions]
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
      const previousServerDraft = draftStateRef.current?.draft ? normalizeIncomingDraft(draftStateRef.current.draft) : null;
      draftStateRef.current = next;
      setDraftState(next);
      if (batchId && currentEntryId) {
        actions.syncPhotoBatchEntryDraft(batchId, currentEntryId, next);
      }
      if (!next?.draft) return;

      setDraft((current) => {
        const normalized = normalizeIncomingDraft(next.draft);
        const mergedDraft = preserveEditedDraftFields(current, previousServerDraft, normalized);
        const optionIds = [next.images?.cutout?.fileId, next.images?.catalog?.fileId].filter(Boolean);
        const currentSelectionIsValid =
          mergedDraft.primaryImageFileId && optionIds.includes(mergedDraft.primaryImageFileId);
        const selectedPrimaryImageId =
          currentSelectionIsValid
            ? mergedDraft.primaryImageFileId
            : normalized.primaryImageFileId ?? next.images?.cutout?.fileId ?? next.images?.catalog?.fileId ?? null;
        let selectedImage = normalized.image;

        if (selectedPrimaryImageId && next.images?.catalog?.fileId === selectedPrimaryImageId) {
          selectedImage = imageSourceForOption(next.images.catalog) ?? selectedImage;
        } else if (selectedPrimaryImageId && next.images?.cutout?.fileId === selectedPrimaryImageId) {
          selectedImage = imageSourceForOption(next.images.cutout) ?? selectedImage;
        } else if (currentSelectionIsValid) {
          selectedImage = current.image ?? selectedImage;
        }

        return normalizeDraft(
          {
            ...mergedDraft,
            primaryImageFileId: selectedPrimaryImageId,
            image: selectedImage,
          },
          current
        );
      });
    },
    [actions, batchId, currentEntryId, normalizeDraft, normalizeIncomingDraft]
  );

  useEffect(() => {
    setDraft((current) => normalizeDraft(current, current));
  }, [normalizeDraft]);

  useEffect(() => {
    draftStateRef.current = draftState;
  }, [draftState]);

  useEffect(() => {
    if (!existingItem || draftId) return;
    setDraft(normalizeDraft(createDraftFromItem(existingItem, colorOptions, { seasonOptions, statusOptions }), existingItem));
  }, [colorOptions, draftId, existingItem, normalizeDraft, seasonOptions, statusOptions]);

  useEffect(() => {
    const updatedDraftState = route.params?.updatedDraftState;
    if (!updatedDraftState || updatedDraftState.id !== draftId) return;
    syncDraftState(updatedDraftState);
  }, [draftId, route.params?.updatedDraftState, syncDraftState]);

  const allowScreenRemoval = useCallback(
    (callback = null) => {
      allowRemoveRef.current = true;
      callback?.();
    },
    []
  );

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

  const finishBatch = useCallback(
    (itemId = null) => {
      actions.clearPhotoBatch(batchId);
      if (itemId) {
        allowScreenRemoval(() => {
          navigation.reset({
            index: 1,
            routes: [
              { name: Routes.WardrobeHome },
              { name: Routes.WardrobeItemDetails, params: { itemId } },
            ],
          });
        });
        return;
      }

      allowScreenRemoval(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: Routes.WardrobeHome }],
        });
      });
    },
    [actions, allowScreenRemoval, batchId, navigation]
  );

  const openBatchEntry = useCallback(
    async (nextEntry) => {
      if (!nextEntry) {
        finishBatch();
        return;
      }

      if (!nextEntry.draftId) {
        allowScreenRemoval(() => navigation.replace(Routes.WardrobeProcessingStub, { batchId, entryId: nextEntry.id }));
        return;
      }

      if (isPhotoBatchEntryReady(nextEntry)) {
        allowScreenRemoval(() => {
          navigation.replace(Routes.WardrobeConfirmItem, {
            draftId: nextEntry.draftId,
            draft: nextEntry.draft,
            batchId,
            entryId: nextEntry.id,
          });
        });
        return;
      }

      try {
        const nextState = await actions.refreshPhotoBatchEntry(batchId, nextEntry.id);
        if (nextState.ready) {
          allowScreenRemoval(() => {
            navigation.replace(Routes.WardrobeConfirmItem, {
              draftId: nextEntry.draftId,
              draft: nextState.draft,
              batchId,
              entryId: nextEntry.id,
            });
          });
          return;
        }
      } catch {
        allowScreenRemoval(() => navigation.replace(Routes.WardrobeProcessingStub, { batchId, entryId: nextEntry.id }));
        return;
      }

      allowScreenRemoval(() => navigation.replace(Routes.WardrobeProcessingStub, { batchId, entryId: nextEntry.id }));
    },
    [actions, allowScreenRemoval, batchId, finishBatch, navigation]
  );

  const handleSkipCurrentPhoto = useCallback(() => {
    if (!isBatchMode || !currentEntryId) {
      navigation.goBack();
      return;
    }

    const result = actions.advancePhotoBatchEntry(batchId, currentEntryId, { skip: true });
    if (result.hasNext) {
      openBatchEntry(result.nextEntry);
      return;
    }

    finishBatch(result.lastSavedItemId);
  }, [actions, batchId, currentEntryId, finishBatch, isBatchMode, navigation, openBatchEntry]);

  const openBatchExitPrompt = useCallback(() => {
    Alert.alert("Что сделать с этим фото?", "Можно пропустить текущее фото, отменить всю очередь или вернуться к редактированию.", [
      { text: "Продолжить редактирование", style: "cancel" },
      { text: "Пропустить фото", onPress: handleSkipCurrentPhoto },
      {
        text: "Отменить всю очередь",
        style: "destructive",
        onPress: () => finishBatch(),
      },
    ]);
  }, [finishBatch, handleSkipCurrentPhoto]);

  usePreventRemove(isBatchMode, ({ data }) => {
    if (allowRemoveRef.current) {
      allowRemoveRef.current = false;
      navigation.dispatch(data.action);
      return;
    }
    openBatchExitPrompt();
  });

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
    const validationMessage = getWardrobeDraftValidationMessage(preparedDraft, {
      requirePrimaryImage: Boolean(draftId && preparedDraft.sourceType !== "catalog"),
    });
    if (validationMessage) {
      throw new Error(validationMessage);
    }

    if (existingItem) {
      const updated = await actions.updateItem(existingItem.id, preparedDraft);
      return updated ?? { ...existingItem, ...preparedDraft };
    }

    if (draftId) {
      return actions.confirmDraft(draftId, preparedDraft);
    }

    return actions.addItem(preparedDraft);
  };

  if (isBatchMode && !batch) {
    return (
      <Screen padded>
        <View
          style={{
            marginTop: spacing.xxl,
            padding: spacing.lg,
            borderRadius: radius.xl,
            backgroundColor: colors.secondaryBackground,
            gap: spacing.sm,
          }}
        >
          <Text style={[typography.h2, { color: colors.text, textAlign: "center" }]}>Очередь не найдена</Text>
          <Text style={[typography.body, { color: colors.secondaryText, textAlign: "center" }]}>
            Очередь фотографий была завершена или очищена.
          </Text>
        </View>
        <ActionButton
          label="Вернуться в шкаф"
          icon="home-outline"
          onPress={() => allowScreenRemoval(() => navigation.replace(Routes.WardrobeHome))}
          style={{ marginTop: spacing.lg }}
          fullWidth
        />
      </Screen>
    );
  }

  return (
    <Screen scroll padded withKeyboard>
      {currentProgress ? (
        <View
          style={{
            marginBottom: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.secondaryBackground,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <Text style={[typography.meta, { color: colors.secondaryText, textAlign: "center" }]}>{currentProgress.label}</Text>
        </View>
      ) : null}

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
            (draftState?.editorImageUrl || draftState?.originalImagePreviewDataUrl || draftState?.originalImageUrl) &&
            draftState?.maskBitmap?.dataBase64
              ? () =>
                  actions.fetchDraft(draftId).then((latestDraftState) => {
                    syncDraftState(latestDraftState);
                    navigation.push(Routes.WardrobeMaskEditor, {
                      draftId,
                      ...(batchId ? { batchId } : {}),
                      ...(currentEntryId ? { entryId: currentEntryId } : {}),
                      returnRouteKey: route.key,
                      editorOpenedAt: Date.now(),
                      cutoutImageUrl: latestDraftState.images?.cutout?.imageUrl ?? draftState.images.cutout.imageUrl,
                      maskImageUrl: latestDraftState.maskImageUrl ?? draftState.maskImageUrl,
                      maskBitmap: latestDraftState.maskBitmap ?? draftState.maskBitmap,
                      editorImageUrl: latestDraftState.editorImageUrl ?? draftState.editorImageUrl,
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
                allowScreenRemoval(() => navigation.goBack());
                return;
              }

              if (isBatchMode && currentEntryId) {
                const result = actions.advancePhotoBatchEntry(batchId, currentEntryId, { savedItemId: saved.id });
                if (result.hasNext) {
                  await openBatchEntry(result.nextEntry);
                  return;
                }

                finishBatch(saved.id);
                return;
              }

              allowScreenRemoval(() => {
                navigation.reset({
                  index: 1,
                  routes: [
                    { name: Routes.WardrobeHome },
                    { name: Routes.WardrobeItemDetails, params: { itemId: saved.id } },
                  ],
                });
              });
            } catch (saveError) {
              Alert.alert("Не удалось сохранить", saveError.message || "Попробуйте еще раз.");
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
          onPress={() => {
            if (isBatchMode) {
              openBatchExitPrompt();
              return;
            }
            allowScreenRemoval(() => navigation.goBack());
          }}
          fullWidth
        />
      </View>
    </Screen>
  );
}
