import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Screen from "../../components/Screen";
import ActionButton from "../../components/ActionButton";
import { useAppTheme } from "../../theme/ThemeProvider";
import { Routes } from "../../navigation/routes";
import { useWardrobe } from "../../store/WardrobeStore";

const steps = [
  { status: "contour_preparing", title: "Подготовка контура вещи" },
  { status: "background_removing", title: "Будущее удаление фона" },
  { status: "category_recognizing", title: "Будущее распознавание категории" },
  { status: "attributes_suggested", title: "Подбор моковых атрибутов для подтверждения" },
];

function stepDone(currentStatus, stepIndex) {
  if (currentStatus === "ready") return true;
  if (currentStatus === "attributes_suggested") return true;
  const currentIndex = steps.findIndex((step) => step.status === currentStatus);
  return currentIndex >= stepIndex;
}

export default function WardrobeProcessingStubScreen({ navigation, route }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { actions } = useWardrobe();
  const [draftState, setDraftState] = useState(null);
  const [error, setError] = useState("");
  const draftId = route.params?.draftId;

  useEffect(() => {
    let alive = true;
    let timer = null;

    async function poll() {
      if (!draftId) return;
      try {
        const next = await actions.fetchDraft(draftId);
        if (!alive) return;
        setDraftState(next);
        if (next.processingStatus === "failed") {
          setError(next.errorMessage || "Не удалось обработать изображение");
          return;
        }
        if (next.ready) {
          navigation.replace(Routes.WardrobeConfirmItem, { draftId, draft: next.draft });
          return;
        }
        timer = setTimeout(poll, 650);
      } catch (requestError) {
        if (alive) setError(requestError.message || "Не удалось обработать изображение");
      }
    }

    poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [actions, draftId, navigation]);

  const ready = draftState?.ready;
  const currentStatus = draftState?.processingStatus ?? "contour_preparing";

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
        <ActivityIndicator color={colors.text} size="large" />
        <Text style={[typography.h2, { color: colors.text, marginTop: spacing.md, textAlign: "center" }]}>
          Обработка вещи
        </Text>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.sm, textAlign: "center" }]}>
          Скоро здесь будет автоматическое распознавание вещи, удаление фона и предложение атрибутов.
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
          onPress={() => navigation.replace(Routes.WardrobeConfirmItem, { draftId, draft: draftState.draft })}
          style={{ marginTop: spacing.lg }}
          fullWidth
        />
      ) : null}
    </Screen>
  );
}
