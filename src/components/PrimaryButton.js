import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";

export default function PrimaryButton({
  title,
  onPress,
  icon,
  variant = "primary",
  disabled = false,
  style,
}) {
  const { colors, radius, spacing, typography } = useAppTheme();

  const palette = getPalette({ colors, variant });

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: 46,
          borderRadius: radius.pill,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          paddingHorizontal: spacing.md,
          opacity: disabled ? 0.45 : pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon ? <Ionicons name={icon} size={18} color={palette.text} /> : null}
        <Text style={[typography.body, { color: palette.text, fontWeight: typography.weights.medium }]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

function getPalette({ colors, variant }) {
  switch (variant) {
    case "ghost":
      return {
        bg: "transparent",
        text: colors.text,
        border: colors.border,
      };
    case "danger":
      return {
        bg: colors.dangerSoft,
        text: colors.danger,
        border: colors.danger,
      };
    case "primary":
    default:
      return {
        bg: colors.accentSoft,
        text: colors.text,
        border: colors.accent,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
