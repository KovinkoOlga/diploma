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
  const { colors, spacing, typography, radius } = useAppTheme();

  const palette = getPalette({ colors, variant });

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
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={[typography.sectionTitle, { color: palette.text }]} numberOfLines={1}>
          {title}
        </Text>
        {icon ? (
          <Ionicons
            name={icon}
            size={16}
            color={palette.text}
            style={{ marginLeft: spacing.xs, opacity: 0.8 }}
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
