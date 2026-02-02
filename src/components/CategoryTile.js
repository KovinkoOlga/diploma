import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Card from "./Card";
import { useAppTheme } from "../theme/ThemeProvider";
import { categoryTones } from "../theme/colors";

export default function CategoryTile({ title, icon, count, tone = "blue", onPress }) {
  const { colors, spacing, typography } = useAppTheme();
  const accent = categoryTones[tone] ?? colors.accent;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.92 : 1 }]}>
      <Card style={{ padding: spacing.md }} variant="flat">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: colors.chipBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={icon} size={18} color={accent} />
          </View>
          <Text style={[typography.caption, { color: colors.mutedText }]}>{count}</Text>
        </View>
        <Text
          style={{
            marginTop: spacing.sm,
            color: colors.text,
            ...typography.body,
            fontWeight: typography.weights.medium,
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
      </Card>
    </Pressable>
  );
}
