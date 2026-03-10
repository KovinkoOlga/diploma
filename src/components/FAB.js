import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";

export default function FAB({ onPress, icon = "add", style }) {
  const { colors, spacing, radius } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          opacity: pressed ? 0.85 : 1,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius.pill,
          padding: spacing.sm,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    right: 16,
    bottom: 110,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
