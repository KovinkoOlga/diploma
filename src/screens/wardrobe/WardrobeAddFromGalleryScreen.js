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

export default function WardrobeAddFromGalleryScreen({ navigation }) {
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
        <Text style={[typography.h2, { color: colors.text }]}>Загрузить из галереи</Text>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: 8 }]}>
          Сейчас поток работает на одном mock-файле. Позже сюда можно будет подключить множественную загрузку без переделки экрана.
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
        <SectionHeader title="Каталог" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
          {catalogs.map((catalog) => (
            <Chip key={catalog.id} label={catalog.title} selected={catalogId === catalog.id} onPress={() => setCatalogId(catalog.id)} />
          ))}
        </View>
      </View>

      <ActionButton
        label="Запустить обработку"
        icon="cloud-upload-outline"
        onPress={() => navigation.navigate(Routes.WardrobeProcessingStub, { sourceType: "gallery", catalogId })}
        style={{ marginTop: spacing.lg }}
        fullWidth
      />
    </Screen>
  );
}
