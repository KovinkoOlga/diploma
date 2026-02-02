import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";

export default function EmptyState({ icon = "sparkles-outline", title, subtitle, action }) {
  const { colors, spacing, typography } = useAppTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          backgroundColor: colors.chipBg,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.sm,
        }}
      >
        <Ionicons name={icon} size={22} color={colors.icon} />
      </View>
      <Text
        style={[typography.h3, { color: colors.text, textAlign: "center" }]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            typography.body,
            {
              marginTop: spacing.xs,
              color: colors.mutedText,
              textAlign: "center",
              maxWidth: 320,
            },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}
