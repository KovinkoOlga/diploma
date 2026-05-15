import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";
import ActionButton from "./ActionButton";

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }) {
  const { colors, typography, spacing } = useAppTheme();

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.secondaryBackground,
        }}
      >
        <Ionicons name={icon} size={22} color={colors.secondaryText} />
      </View>
      <Text style={[typography.sectionTitle, { color: colors.text, marginTop: spacing.md }]}>{title}</Text>
      <Text style={[typography.body, { color: colors.secondaryText, marginTop: 6, textAlign: "center" }]}>
        {subtitle}
      </Text>
      {actionLabel ? <ActionButton label={actionLabel} variant="secondary" onPress={onAction} style={{ marginTop: spacing.md }} /> : null}
    </View>
  );
}
