import React from "react";
import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";

export default function SectionHeader({ title, actionLabel, onAction }) {
  const { colors, typography } = useAppTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={[typography.sectionTitle, { color: colors.text }]}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[typography.caption, { color: colors.secondaryText }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
