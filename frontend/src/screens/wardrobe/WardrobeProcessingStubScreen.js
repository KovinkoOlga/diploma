import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import Screen from "../../components/Screen";
import ActionButton from "../../components/ActionButton";
import { Routes } from "../../navigation/routes";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAppTheme } from "../../theme/ThemeProvider";
import {
  getPhotoBatchCurrentEntry,
  getPhotoBatchEntry,
  getPhotoBatchProgress,
  isPhotoBatchEntryFailed,
  isPhotoBatchEntryReady,
  isPhotoBatchEntryWaitingForUpload,
} from "../../utils/wardrobePhotoBatch";

const steps = [
  { status: "contour_preparing", title: "Подготавливаем изображение" },
  { status: "background_removing", title: "Удаляем фон" },
  { status: "category_recognizing", title: "Определяем категорию и подкатегорию" },
  { status: "colors_extracting", title: "Определяем цвета" },
  { status: "attributes_suggested", title: "Готовим карточку вещи" },
];

function stepDone(currentStatus, stepIndex) {
  if (!currentStatus) return false;
  if (currentStatus === "ready" || currentStatus === "attributes_suggested") return true;
  const currentIndex = steps.findIndex((step) => step.status === currentStatus);
  return currentIndex >= stepIndex;
}

export default function WardrobeProcessingStubScreen({ navigation, route }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { photoBatch, actions } = useWardrobe();
  const [draftState, setDraftState] = useState(null);
  const [error, setError] = useState("");
  const forwardedDraftKeyRef = useRef("");
  const allowRemoveRef = useRef(false);
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
  const activeDraftId = isBatchMode ? currentEntry?.draftId : draftId;
  const isWaitingForUpload = isBatchMode && isPhotoBatchEntryWaitingForUpload(currentEntry);
  const isEntryFailed = isBatchMode ? isPhotoBatchEntryFailed(currentEntry) || Boolean(error) : Boolean(error);
  const allowScreenRemoval = useCallback(
    (callback = null) => {
      allowRemoveRef.current = true;
      callback?.();
    },
    []
  );

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

  const openBatchCancelPrompt = useCallback(() => {
    Alert.alert("Отменить очередь?", "Все выбранные фотографии будут убраны из очереди.", [
      { text: "Продолжить", style: "cancel" },
      {
        text: "Отменить очередь",
        style: "destructive",
        onPress: () => finishBatch(),
      },
    ]);
  }, [finishBatch]);

  const openConfirmScreen = useCallback(
    (nextDraftState, nextDraftId, entryId = currentEntryId) => {
      const forwardKey = `${batchId || "single"}:${nextDraftId}`;
      if (forwardedDraftKeyRef.current === forwardKey) return;
      forwardedDraftKeyRef.current = forwardKey;
      allowScreenRemoval(() => {
        navigation.replace(Routes.WardrobeConfirmItem, {
          draftId: nextDraftId,
          draft: nextDraftState.draft,
          ...(batchId ? { batchId, entryId } : {}),
        });
      });
    },
    [allowScreenRemoval, batchId, currentEntryId, navigation]
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
        openConfirmScreen(nextEntry.draftState ?? { draft: nextEntry.draft }, nextEntry.draftId, nextEntry.id);
        return;
      }

      try {
        const nextState = await actions.refreshPhotoBatchEntry(batchId, nextEntry.id);
        if (nextState?.ready) {
          openConfirmScreen(nextState, nextEntry.draftId, nextEntry.id);
          return;
        }
      } catch {
        allowScreenRemoval(() => navigation.replace(Routes.WardrobeProcessingStub, { batchId, entryId: nextEntry.id }));
        return;
      }

      allowScreenRemoval(() => navigation.replace(Routes.WardrobeProcessingStub, { batchId, entryId: nextEntry.id }));
    },
    [actions, allowScreenRemoval, batchId, finishBatch, navigation, openConfirmScreen]
  );

  const goToNextBatchEntry = useCallback(
    (result) => {
      if (result.hasNext) {
        openBatchEntry(result.nextEntry);
        return;
      }
      finishBatch(result.lastSavedItemId);
    },
    [finishBatch, openBatchEntry]
  );

  usePreventRemove(isBatchMode, ({ data }) => {
    if (allowRemoveRef.current) {
      allowRemoveRef.current = false;
      navigation.dispatch(data.action);
      return;
    }
    openBatchCancelPrompt();
  });

  useEffect(() => {
    if (!isBatchMode) return;
    forwardedDraftKeyRef.current = "";
    setDraftState(currentEntry?.draftState ?? null);
    setError(currentEntry?.error || "");
  }, [currentEntry?.draftState, currentEntry?.error, currentEntryId, isBatchMode]);

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function poll() {
      if (isBatchMode && !currentEntryId) {
        timer = setTimeout(poll, 450);
        return;
      }

      if (!activeDraftId) {
        setError("");
        timer = setTimeout(poll, 450);
        return;
      }

      if (isBatchMode && isPhotoBatchEntryReady(currentEntry)) {
        openConfirmScreen(currentEntry.draftState ?? { draft: currentEntry.draft }, activeDraftId, currentEntry.id);
        return;
      }

      try {
        const next = isBatchMode
          ? await actions.refreshPhotoBatchEntry(batchId, currentEntryId)
          : await actions.fetchDraft(activeDraftId);
        if (!alive) return;

        if (!next) {
          setError("");
          timer = setTimeout(poll, 450);
          return;
        }

        setDraftState(next);
        if (next.processingStatus === "failed") {
          setError(next.errorMessage || "Не удалось обработать изображение");
          return;
        }

        setError("");
        if (next.ready) {
          openConfirmScreen(next, activeDraftId, currentEntryId);
          return;
        }

        timer = setTimeout(poll, 650);
      } catch (requestError) {
        if (!alive) return;
        const errorMessage = String(requestError?.message || "").toLowerCase();
        if (isBatchMode && (!currentEntry?.draftId || errorMessage.includes("черновик") || errorMessage.includes("draft"))) {
          setError("");
          timer = setTimeout(poll, 450);
          return;
        }
        setError(requestError.message || "Не удалось обработать изображение");
      }
    }

    poll();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [actions, activeDraftId, batchId, currentEntry, currentEntryId, isBatchMode, openConfirmScreen]);

  const currentStatus = currentEntry?.processingStatus ?? draftState?.processingStatus ?? null;
  const ready = Boolean(draftState?.ready);

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
            Очередь фотографий была очищена или недоступна.
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
    <Screen padded>
      <View
        style={{
          marginTop: spacing.xxl,
          padding: spacing.lg,
          borderRadius: radius.xl,
          backgroundColor: colors.secondaryBackground,
          alignItems: "center",
        }}
      >
        {currentProgress ? (
          <View
            style={{
              alignSelf: "stretch",
              marginBottom: spacing.md,
              alignItems: "center",
            }}
          >
            <Text style={[typography.meta, { color: colors.secondaryText }]}>{currentProgress.label}</Text>
          </View>
        ) : null}
        <ActivityIndicator color={colors.text} size="large" />
        <Text style={[typography.h2, { color: colors.text, marginTop: spacing.md, textAlign: "center" }]}>
          {isWaitingForUpload && currentProgress ? `Загружаем фото ${currentProgress.current} из ${currentProgress.total}` : "Обработка вещи"}
        </Text>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.sm, textAlign: "center" }]}>
          {isWaitingForUpload
            ? "Создаем черновик и отправляем фото в обработку. Остальные фотографии продолжают загружаться в фоне."
            : "Анализируем фото: удаляем фон, определяем тип вещи и основные атрибуты."}
        </Text>
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {steps.map((step, index) => (
          <View
            key={step.status}
            style={{
              borderWidth: 1,
              borderColor: stepDone(currentStatus, index) ? colors.text : colors.border,
              borderRadius: radius.lg,
              backgroundColor: colors.secondaryBackground,
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              opacity: isWaitingForUpload ? 0.72 : 1,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.background,
                marginRight: spacing.sm,
              }}
            >
              <Text style={[typography.meta, { color: colors.text }]}>{index + 1}</Text>
            </View>
            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{step.title}</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={[typography.body, { color: colors.danger, marginTop: spacing.md }]}>{error}</Text> : null}

      {ready ? (
        <ActionButton
          label="Продолжить к подтверждению"
          icon="arrow-forward-outline"
          onPress={() => openConfirmScreen(draftState, activeDraftId)}
          style={{ marginTop: spacing.lg }}
          fullWidth
        />
      ) : null}

      {isBatchMode && currentEntryId && isEntryFailed ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <ActionButton
            label="Повторить"
            icon="refresh-outline"
            onPress={() => {
              setDraftState(null);
              setError("");
              actions.retryPhotoBatchEntry(batchId, currentEntryId);
            }}
            fullWidth
          />
          <ActionButton
            label="Пропустить фото"
            icon="play-skip-forward-outline"
            variant="secondary"
            onPress={() => goToNextBatchEntry(actions.advancePhotoBatchEntry(batchId, currentEntryId, { skip: true }))}
            fullWidth
          />
          <ActionButton
            label="Отменить всю очередь"
            icon="close-outline"
            variant="ghost"
            onPress={openBatchCancelPrompt}
            fullWidth
          />
        </View>
      ) : null}
    </Screen>
  );
}
