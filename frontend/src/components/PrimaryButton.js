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
  scale = 1,
  style,
}) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const safeScale = Number.isFinite(scale) ? Math.max(scale, 0.5) : 1;
  const palette = getPalette({ colors, variant });
  const titleStyle = {
    ...typography.sectionTitle,
    color: palette.text,
    fontSize: (typography.sectionTitle?.fontSize ?? 16) * safeScale,
    lineHeight: typography.sectionTitle?.lineHeight
      ? typography.sectionTitle.lineHeight * safeScale
      : undefined,
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: radius.pill,
          paddingVertical: spacing.sm * safeScale,
          paddingHorizontal: spacing.md * safeScale,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={titleStyle} numberOfLines={1}>
          {title}
        </Text>
        {icon ? (
          <Ionicons
            name={icon}
            size={Math.max(12, Math.round(16 * safeScale))}
            color={palette.text}
            style={{ marginLeft: spacing.xs * safeScale, opacity: 0.8 }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function getPalette({ colors, variant }) {
  switch (variant) {
    case "secondary":
      return {
        bg: colors.bg2 ?? colors.card2,
        text: colors.text,
        border: colors.border,
      };
    case "ghost":
      return {
        bg: "transparent",
        text: colors.text,
        border: colors.border,
      };
    case "danger":
      return {
        bg: colors.danger,
        text: "#FFFFFF",
        border: colors.danger,
      };
    case "primary":
    default:
      return {
        bg: colors.text,
        text: colors.bg,
        border: colors.text,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
