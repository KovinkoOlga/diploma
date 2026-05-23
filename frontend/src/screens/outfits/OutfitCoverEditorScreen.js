import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { manipulateAsync } from "expo-image-manipulator";
import Screen from "../../components/Screen";
import OutfitCoverCanvas from "../../components/OutfitCoverCanvas";
import OutfitCoverObjectControls from "../../components/OutfitCoverObjectControls";
import ActionButton from "../../components/ActionButton";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import {
  createBaseCoverEditorState,
  reorderCoverObject,
  syncCoverStateWithItems,
  updateCoverObject,
} from "../../utils/outfitCover";
import { preloadOutfitCoverImages } from "../../utils/preloadOutfitImages";

const HISTORY_LIMIT = 20;

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

export default function OutfitCoverEditorScreen({ navigation, route }) {
  const { typography, colors, spacing, radius } = useAppTheme();
  const { items, outfitDraftSessions, actions } = useWardrobe();
  const sessionId = route.params?.draftSessionId;
  const draft = sessionId ? outfitDraftSessions[sessionId] : null;
  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);

  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);
  const [preparingImages, setPreparingImages] = useState(true);
  const [imagesFailed, setImagesFailed] = useState([]);
  const [prepareTick, setPrepareTick] = useState(0);
  const [editorState, setEditorState] = useState(() =>
    createBaseCoverEditorState(draft?.itemIds ?? [], itemById, draft?.coverEditorStateJson)
  );
  const [selectedItemId, setSelectedItemId] = useState(() => editorState.objects?.[0]?.itemId ?? null);

  const exportCoverRef = useRef(null);
  const transparentRef = useRef(null);

  const remember = () => {
    setHistory((current) => [...current.slice(-(HISTORY_LIMIT - 1)), cloneState(editorState)]);
    setRedoHistory([]);
  };

  const mutateState = (updater) => {
    setEditorState((current) => updater(current));
  };

  const onUndo = () => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setRedoHistory((current) => [...current.slice(-(HISTORY_LIMIT - 1)), cloneState(editorState)]);
    setHistory((current) => current.slice(0, -1));
    setEditorState(previous);
  };

  const onRedo = () => {
    if (!redoHistory.length) return;
    const next = redoHistory[redoHistory.length - 1];
    setHistory((current) => [...current.slice(-(HISTORY_LIMIT - 1)), cloneState(editorState)]);
    setRedoHistory((current) => current.slice(0, -1));
    setEditorState(next);
  };

  const onSave = async () => {
    if (!editorState.objects.length) {
      Alert.alert("Обложка", "Добавьте хотя бы один объект на обложку.");
      return;
    }

    setSaving(true);
    try {
      const coverUri = await captureRef(exportCoverRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      const transparentUri = await captureRef(transparentRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      const thumb = await manipulateAsync(coverUri, [{ resize: { width: 640 } }], { compress: 0.9, format: "jpeg" });

      const uploaded = await actions.uploadOutfitCover({
        mode: "composition",
        coverAsset: { uri: coverUri, name: "outfit-cover.png", type: "image/png" },
        transparentAsset: {
          uri: transparentUri,
          name: "outfit-cover-transparent.png",
          type: "image/png",
        },
        thumbnailAsset: { uri: thumb.uri, name: "outfit-cover-thumb.jpg", type: "image/jpeg" },
      });

      const coverTransparentImage = uploaded.coverTransparentImageUrl ? { uri: uploaded.coverTransparentImageUrl } : null;
      const coverImage = uploaded.coverImageUrl ? { uri: uploaded.coverImageUrl } : null;

      actions.updateOutfitDraftSession(sessionId, {
        coverMode: "composition",
        coverFileId: uploaded.fileId,
        coverImageUrl: uploaded.coverImageUrl,
        coverTransparentImageUrl: uploaded.coverTransparentImageUrl,
        coverImage: coverTransparentImage ?? coverImage,
        coverTransparentImage,
        coverEditorStateJson: {
          ...editorState,
          mode: "composition",
        },
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert("Обложка", error.message || "Не удалось сохранить обложку.");
    } finally {
      setSaving(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Обложка образа",
      headerRight: () => (
        <Pressable
          onPress={onSave}
          disabled={saving}
          hitSlop={8}
          style={({ pressed }) => ({
            backgroundColor: colors.text,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: 8,
            opacity: saving ? 0.45 : pressed ? 0.6 : 1,
          })}
        >
          <Text style={[typography.button, { color: colors.background }]}>
            {saving ? "Сохраняем..." : "Сохранить"}
          </Text>
        </Pressable>
      ),
    });
  }, [colors.background, colors.text, navigation, onSave, radius.pill, saving, spacing.md, typography.button]);

  useEffect(() => {
    if (!draft) return;
    const synced = syncCoverStateWithItems("composition", editorState, draft.itemIds ?? [], itemById);
    setEditorState(synced);
    if (!synced.objects.some((entry) => entry.itemId === selectedItemId)) {
      setSelectedItemId(synced.objects[0]?.itemId ?? null);
    }
  }, [draft?.itemIds, itemById]);

  const draftItems = useMemo(
    () => (draft?.itemIds ?? []).map((itemId) => itemById[itemId]).filter(Boolean),
    [draft?.itemIds, itemById]
  );

  useEffect(() => {
    let cancelled = false;

    if (!draft) {
      setPreparingImages(false);
      setImagesFailed([]);
      return undefined;
    }

    setPreparingImages(true);
    setImagesFailed([]);

    preloadOutfitCoverImages(draftItems, { timeoutMs: 12000 })
      .then(({ failedItems }) => {
        if (cancelled) return;
        setImagesFailed(failedItems);
        if (__DEV__ && failedItems.length) {
          console.warn("[OutfitCover] Preload check failed inside cover editor", failedItems);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (__DEV__) {
          console.warn("[OutfitCover] Preload check threw inside cover editor", error);
        }
        setImagesFailed([
          {
            itemId: null,
            reason: error?.message || "preload_failed",
          },
        ]);
      })
      .finally(() => {
        if (!cancelled) {
          setPreparingImages(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [draft, draftItems, prepareTick]);

  if (!draft) {
    return (
      <Screen padded>
        <Text style={[typography.body, { color: colors.secondaryText }]}>Сессия редактирования обложки не найдена.</Text>
      </Screen>
    );
  }

  if (preparingImages) {
    return (
      <Screen padded>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={[typography.body, { color: colors.text, marginTop: spacing.sm }]}>Подготавливаем изображения...</Text>
          <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 6, textAlign: "center" }]}>
            Загружаем вещи для редактора обложки
          </Text>
        </View>
      </Screen>
    );
  }

  if (imagesFailed.length) {
    return (
      <Screen padded>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={[typography.body, { color: colors.text }]}>Не удалось подготовить изображения для обложки.</Text>
          <Text style={[typography.caption, { color: colors.secondaryText, marginTop: spacing.xs }]}>
            Проверьте подключение и попробуйте снова.
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <ActionButton
              label="Повторить"
              icon="refresh-outline"
              variant="secondary"
              onPress={() => setPrepareTick((value) => value + 1)}
            />
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <ActionButton
              label="Назад"
              icon="arrow-back-outline"
              variant="ghost"
              onPress={() => navigation.goBack()}
            />
          </View>
        </View>
      </Screen>
    );
  }

  const selectedObject = editorState.objects.find((entry) => entry.itemId === selectedItemId) ?? null;

  return (
    <Screen
      padded={false}
      contentStyle={{
        paddingTop: 0,
        paddingBottom: 4,
        paddingHorizontal: spacing.xs,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <OutfitCoverCanvas
            editorState={editorState}
            itemById={itemById}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onCommitObject={(itemId, patch) => {
              remember();
              mutateState((current) => updateCoverObject(current, itemId, patch));
            }}
            showSelectionTint
          />
        </View>

        <View style={{ marginTop: spacing.xs }}>
          <OutfitCoverObjectControls
            selectedObject={selectedObject}
            onPatch={(patch) => {
              remember();
              mutateState((current) => updateCoverObject(current, selectedItemId, patch));
            }}
            onReorder={(action) => {
              if (!selectedItemId) return;
              remember();
              mutateState((current) => reorderCoverObject(current, selectedItemId, action));
            }}
            onReset={() => {
              if (!selectedItemId) return;
              remember();
              mutateState((current) =>
                updateCoverObject(current, selectedItemId, {
                  scale: 1,
                  rotation: 0,
                  flipX: false,
                  crop: "none",
                })
              );
            }}
            onUndo={onUndo}
            onRedo={onRedo}
            canUndo={history.length > 0}
            canRedo={redoHistory.length > 0}
          />
        </View>
      </View>

      <View style={{ position: "absolute", left: -2400, top: -2400, width: 420 }}>
        <OutfitCoverCanvas
          editorState={editorState}
          itemById={itemById}
          selectedItemId={null}
          onSelectItem={() => null}
          onCommitObject={() => null}
          backgroundColor="#FFFFFF"
          interactive={false}
          showFrame={false}
          showSelectionTint={false}
          canvasRef={exportCoverRef}
        />
      </View>

      <View style={{ position: "absolute", left: -2400, top: -2400, width: 420 }}>
        <OutfitCoverCanvas
          editorState={editorState}
          itemById={itemById}
          selectedItemId={null}
          onSelectItem={() => null}
          onCommitObject={() => null}
          backgroundColor="transparent"
          interactive={false}
          showFrame={false}
          showSelectionTint={false}
          canvasRef={transparentRef}
        />
      </View>
    </Screen>
  );
}
