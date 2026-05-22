import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";

export default function SegmentedControl({ options, value, onChange }) {
  const { colors, typography, radius } = useAppTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.bg2 ?? colors.card2,
          borderColor: colors.border,
          borderRadius: radius.pill,
          padding: 2,
        },
      ]}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.tab,
              {
                opacity: pressed ? 0.85 : 1,
                backgroundColor: selected ? colors.text : "transparent",
                borderRadius: radius.pill,
              },
            ]}
          >
            <Text style={[typography.caption, { color: selected ? colors.background : colors.mutedText }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
});
