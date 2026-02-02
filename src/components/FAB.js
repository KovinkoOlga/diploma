import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";

export default function FAB({ onPress, icon = "add", style }) {
  const { colors, radius, shadows } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
          ...shadows.tabBar,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    right: 16,
    bottom: 110,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
