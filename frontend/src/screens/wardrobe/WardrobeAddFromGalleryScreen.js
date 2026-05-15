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

export default function WardrobeAddFromGalleryScreen({ navigation }) {
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

  const pickAndUpload = async () => {
    if (submitting) return;
    setError("");

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Разрешите доступ к галерее в настройках устройства.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setSelectedAsset(asset);
    setSubmitting(true);
    try {
      const draft = await actions.uploadDraftImage({ sourceType: "gallery", catalogId, asset });
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
        <Text style={[typography.h2, { color: colors.text }]}>Загрузить из галереи</Text>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: 8 }]}>
          Выберите фото вещи, чтобы отправить его на обработку и затем подтвердить карточку.
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
        <SectionHeader title="Каталог" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
          {catalogs.map((catalog) => (
            <Chip key={catalog.id} label={catalog.title} selected={catalogId === catalog.id} onPress={() => setCatalogId(catalog.id)} />
          ))}
        </View>
      </View>

      {error ? <Text style={[typography.body, { color: colors.danger, marginTop: spacing.md }]}>{error}</Text> : null}

      <ActionButton
        label={submitting ? "Загружаем..." : "Выбрать фото и запустить обработку"}
        icon="cloud-upload-outline"
        disabled={submitting}
        onPress={pickAndUpload}
        style={{ marginTop: spacing.lg }}
        fullWidth
      />
    </Screen>
  );
}
