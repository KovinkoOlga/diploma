import React, { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Screen from "../../components/Screen";
import Card from "../../components/Card";
import Avatar from "../../components/Avatar";
import Input from "../../components/Input";
import ActionButton from "../../components/ActionButton";
import SectionHeader from "../../components/SectionHeader";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useAuth } from "../../store/AuthStore";
import ProfileEmailSettingsSection from "./components/ProfileEmailSettingsSection";

function buildGalleryPermissionMessage(permission) {
  if (permission?.canAskAgain === false) {
    return "Доступ к галерее запрещен. Разрешите его в настройках устройства, чтобы загрузить аватар.";
  }

  return "Разрешите доступ к галерее, чтобы выбрать фотографию для аватара.";
}

export default function ProfileSettingsScreen({ navigation }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { currentUser, updateProfile, uploadAvatar } = useAuth();
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState("");
  const [avatarError, setAvatarError] = useState("");

  useEffect(() => {
    setDisplayName(currentUser?.displayName ?? "");
  }, [currentUser?.displayName]);

  const avatarLabel = currentUser?.displayName || currentUser?.email?.split("@")[0] || "Профиль";
  const avatarSource = currentUser?.avatarUrl ? { uri: currentUser.avatarUrl } : undefined;

  async function handleAvatarPress() {
    setAvatarError("");

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        const message = buildGalleryPermissionMessage(permission);
        setAvatarError(message);
        Alert.alert("Нет доступа к галерее", message);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      const asset = result.assets?.[0];

      if (result.canceled || !asset) {
        return;
      }

      setAvatarUploading(true);
      await uploadAvatar(asset);
    } catch (requestError) {
      const message = requestError?.message || "Не удалось загрузить аватар.";
      setAvatarError(message);
      Alert.alert("Аватар", message);
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <Screen scroll padded withKeyboard>
      <View style={{ gap: spacing.lg }}>
        <View style={{ marginTop: spacing.sm }}>
          <Card style={{ padding: spacing.lg, borderRadius: radius.lg, alignItems: "center" }}>
            <Avatar size={96} label={avatarLabel} source={avatarSource} />
            <Text style={[typography.cardTitle, { color: colors.text, marginTop: spacing.md }]}>{avatarLabel}</Text>

            <View style={{ marginTop: spacing.md }}>
              <ActionButton
                label={avatarUploading ? "Загружаем..." : currentUser?.avatarUrl ? "Заменить фото" : "Загрузить аватар"}
                icon="image-outline"
                variant="secondary"
                disabled={avatarUploading}
                onPress={handleAvatarPress}
              />
            </View>
            {avatarError ? (
              <Text style={[typography.caption, { color: colors.danger, marginTop: spacing.sm, textAlign: "center" }]}>
                {avatarError}
              </Text>
            ) : null}
          </Card>
        </View>

        <View>
          <SectionHeader title="Имя" />
          <Input value={displayName} onChangeText={setDisplayName} placeholder="Имя" style={{ marginTop: 6 }} />
          {error ? <Text style={[typography.body, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text> : null}
        </View>

        <ProfileEmailSettingsSection />

        <ActionButton
          label={saving ? "Сохраняем..." : "Сохранить"}
          icon="checkmark-outline"
          disabled={saving || avatarUploading || !displayName.trim()}
          onPress={async () => {
            setSaving(true);
            setError("");
            try {
              await updateProfile({ displayName: displayName.trim() });
              navigation.goBack();
            } catch (requestError) {
              setError(requestError.message || "Не удалось сохранить профиль");
            } finally {
              setSaving(false);
            }
          }}
          fullWidth
        />
      </View>
    </Screen>
  );
}
