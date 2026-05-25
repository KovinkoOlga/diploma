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

function buildGalleryPermissionMessage(permission) {
  if (permission?.canAskAgain === false) {
    return "Доступ к галерее запрещён. Разрешите его в настройках устройства, чтобы загрузить аватар.";
  }

  return "Разрешите доступ к галерее, чтобы выбрать фотографию для аватара.";
}

export default function ProfileSettingsScreen({ navigation }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { currentUser, updateProfile, uploadAvatar } = useAuth();
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState("");
  const [avatarError, setAvatarError] = useState("");

  useEffect(() => {
    setDisplayName(currentUser?.displayName ?? "");
    setEmail(currentUser?.email ?? "");
  }, [currentUser?.displayName, currentUser?.email]);

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
        <View>
          <SectionHeader title="Личные данные" />
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
        </View>

        <View>
          <Text style={[typography.meta, { color: colors.secondaryText }]}>Имя</Text>
          <Input value={displayName} onChangeText={setDisplayName} placeholder="Имя" style={{ marginTop: 6 }} />
          <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Email</Text>
          <Input value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" style={{ marginTop: 6 }} />
          {error ? <Text style={[typography.body, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text> : null}
        </View>

        <ActionButton
          label={saving ? "Сохраняем..." : "Сохранить"}
          icon="checkmark-outline"
          disabled={saving || avatarUploading || !email.includes("@") || !displayName.trim()}
          onPress={async () => {
            setSaving(true);
            setError("");
            try {
              await updateProfile({ email: email.trim(), displayName: displayName.trim() });
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
