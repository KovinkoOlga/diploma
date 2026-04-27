import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Screen from "../../components/Screen";
import ActionButton from "../../components/ActionButton";
import { useAppTheme } from "../../theme/ThemeProvider";
import { Routes } from "../../navigation/routes";
import { createMockProcessedDraft } from "../../utils/wardrobe";

const steps = [
  "Подготовка контура вещи",
  "Будущее удаление фона",
  "Будущее распознавание категории",
  "Подбор моковых атрибутов для подтверждения",
];

export default function WardrobeProcessingStubScreen({ navigation, route }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const [ready, setReady] = useState(false);
  const draft = useMemo(
    () =>
      createMockProcessedDraft({
        sourceType: route.params?.sourceType,
        catalogId: route.params?.catalogId,
      }),
    [route.params?.catalogId, route.params?.sourceType]
  );

  useEffect(() => {
    const readyTimer = setTimeout(() => setReady(true), 1400);
    const navigateTimer = setTimeout(() => {
      navigation.replace(Routes.WardrobeConfirmItem, { draft });
    }, 2200);

    return () => {
      clearTimeout(readyTimer);
      clearTimeout(navigateTimer);
    };
  }, [draft, navigation]);

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
            key={step}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
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
            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{step}</Text>
          </View>
        ))}
      </View>

      {ready ? (
        <ActionButton
          label="Продолжить к подтверждению"
          icon="arrow-forward-outline"
          onPress={() => navigation.replace(Routes.WardrobeConfirmItem, { draft })}
          style={{ marginTop: spacing.lg }}
          fullWidth
        />
      ) : null}
    </Screen>
  );
}
