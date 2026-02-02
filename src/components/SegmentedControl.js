import React from "react";
import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";

export default function SegmentedControl({ options, value, onChange }) {
  const { colors, radius, spacing, typography } = useAppTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.pill,
        padding: 4,
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              {
                flex: 1,
                paddingVertical: 10,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: selected ? colors.card2 : "transparent",
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text
              style={{
                color: selected ? colors.text : colors.mutedText,
                ...typography.caption,
                fontWeight: selected ? typography.weights.medium : typography.weights.regular,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
