import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";

export default function Chip({ label, selected = false, onPress, style }) {
  const { colors, radius, spacing, typography } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          paddingHorizontal: spacing.sm,
          borderRadius: radius.pill,
          backgroundColor: selected ? colors.accentSoft : colors.chipBg,
          borderColor: selected ? colors.accent : colors.border,
          opacity: pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          typography.caption,
          {
            color: selected ? colors.accent : colors.chipText,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
  },
});
