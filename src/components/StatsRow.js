import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";

export default function StatsRow({ items }) {
  const { colors, typography } = useAppTheme();

  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      {items.map((item) => (
        <View key={item.label} style={{ flex: 1, alignItems: "center" }}>
          <Text style={[typography.sectionTitle, { color: colors.text }]}>{item.value}</Text>
          <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 4 }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
