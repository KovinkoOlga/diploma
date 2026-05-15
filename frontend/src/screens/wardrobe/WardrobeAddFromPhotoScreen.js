import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
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
  const { catalogs, actions } = useWardrobe();
  const [catalogId, setCatalogId] = useState(catalogs[0]?.id ?? "main");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (catalogs.length && !catalogs.some((catalog) => catalog.id === catalogId)) {
      setCatalogId(catalogs[0].id);
    }
  }, [catalogId, catalogs]);

  const takePhotoAndUpload = async () => {
    if (submitting) return;
    setError("");

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Разрешите доступ к камере в настройках устройства.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setSelectedAsset(asset);
    setSubmitting(true);
    try {
      const draft = await actions.uploadDraftImage({ sourceType: "photo", catalogId, asset });
      navigation.navigate(Routes.WardrobeProcessingStub, { draftId: draft.id });
    } catch (requestError) {
      setError(requestError.message || "Не удалось загрузить изображение");
    } finally {
      setSubmitting(false);
    }
  };

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
          Сделайте снимок вещи, чтобы отправить его на обработку и затем подтвердить карточку.
        </Text>
        <MediaPreview
          source={selectedAsset?.uri ? { uri: selectedAsset.uri } : undefined}
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
            "Подготовим изображение для карточки",
            "Переведем на подтверждение с предложенными атрибутами",
          ].map((text) => (
            <Text key={text} style={[typography.body, { color: colors.text }]}>
              • {text}
            </Text>
          ))}
        </View>
      </View>

      {error ? <Text style={[typography.body, { color: colors.danger, marginTop: spacing.md }]}>{error}</Text> : null}

      <ActionButton
        label={submitting ? "Загружаем..." : "Сделать снимок и продолжить"}
        icon="camera-outline"
        disabled={submitting}
        onPress={takePhotoAndUpload}
        style={{ marginTop: spacing.lg }}
        fullWidth
      />
    </Screen>
  );
}
