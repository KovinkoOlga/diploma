import React from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import Card from "../../components/Card";
import { useAppTheme } from "../../theme/ThemeProvider";

export default function SettingsScreen() {
  const { colors, spacing, typography } = useAppTheme();
  return (
    <Screen>
      <View style={{ padding: spacing.md }}>
        <Card style={{ padding: spacing.md }} variant="flat">
          <Text style={[typography.h3, { color: colors.text }]}>Настройки (заглушка)</Text>
          <Text style={[typography.body, { marginTop: 8, color: colors.mutedText }]}>
            Тут можно добавить переключатель темы, уведомления и т.д.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
