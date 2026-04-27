import React, { useState } from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import ActionButton from "../../components/ActionButton";
import Chip from "../../components/Chip";
import MediaPreview from "../../components/MediaPreview";
import SectionHeader from "../../components/SectionHeader";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function WardrobeAddFromPhotoScreen({ navigation }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { catalogs } = useWardrobe();
  const [catalogId, setCatalogId] = useState(catalogs[0]?.id ?? "main");

  return (
    <Screen scroll padded>
      <View
        style={{
          borderRadius: radius.xl,
          backgroundColor: colors.secondaryBackground,
          padding: spacing.md,
        }}
      >
        <Text style={[typography.h2, { color: colors.text }]}>Сфотографировать вещь</Text>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: 8 }]}>
          Реальная камера и AI-обработка будут подключены позже. Сейчас запускается понятный UX-поток со stub-экраном.
        </Text>
        <MediaPreview
          containerStyle={{
            width: "100%",
            aspectRatio: 1,
            backgroundColor: colors.background,
            borderRadius: radius.lg,
            marginTop: spacing.md,
          }}
          placeholderScale={0.42}
        />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Куда сохранить вещь" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
          {catalogs.map((catalog) => (
            <Chip key={catalog.id} label={catalog.title} selected={catalogId === catalog.id} onPress={() => setCatalogId(catalog.id)} />
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Что произойдет дальше" />
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {[
            "Покажем экран обработки вещи",
            "Объясним, что здесь будет обрезка и распознавание",
            "Переведем на подтверждение с моковыми атрибутами",
          ].map((text) => (
            <Text key={text} style={[typography.body, { color: colors.text }]}>
              • {text}
            </Text>
          ))}
        </View>
      </View>

      <ActionButton
        label="Продолжить с демо-снимком"
        icon="arrow-forward-outline"
        onPress={() => navigation.navigate(Routes.WardrobeProcessingStub, { sourceType: "photo", catalogId })}
        style={{ marginTop: spacing.lg }}
        fullWidth
      />
    </Screen>
  );
}
