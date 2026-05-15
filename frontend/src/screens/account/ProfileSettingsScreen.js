import React, { useState } from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import Input from "../../components/Input";
import ActionButton from "../../components/ActionButton";
import SectionHeader from "../../components/SectionHeader";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useAuth } from "../../store/AuthStore";

export default function ProfileSettingsScreen({ navigation }) {
  const { colors, typography, spacing } = useAppTheme();
  const { currentUser, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <Screen scroll padded withKeyboard>
      <SectionHeader title="Личные данные" />
      <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.sm }]}>Имя</Text>
      <Input value={displayName} onChangeText={setDisplayName} placeholder="Имя" style={{ marginTop: 6 }} />
      <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Email</Text>
      <Input value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" style={{ marginTop: 6 }} />
      {error ? <Text style={[typography.body, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text> : null}
      <View style={{ marginTop: spacing.lg }}>
        <ActionButton
          label={saving ? "Сохраняем..." : "Сохранить"}
          icon="checkmark-outline"
          disabled={saving || !email.includes("@") || !displayName.trim()}
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
