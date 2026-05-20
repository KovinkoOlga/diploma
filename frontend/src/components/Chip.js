import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";

export default function Chip({ label, selected = false, compact = false, onPress, leftSlot = null }) {
  const { colors, typography, radius, spacing } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
      <View
        style={[
          styles.chip,
          {
            minHeight: compact ? 28 : 34,
            paddingHorizontal: compact ? spacing.sm : spacing.md,
            backgroundColor: selected ? colors.chipActiveBackground : colors.chipBackground,
            borderColor: selected ? colors.chipActiveBackground : colors.border,
            borderRadius: radius.pill,
          },
        ]}
      >
        {leftSlot ? <View style={{ marginRight: spacing.xs }}>{leftSlot}</View> : null}
        <Text
          style={[
            compact ? typography.meta : typography.caption,
            {
              color: selected ? colors.chipActiveText : colors.chipText,
            },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
