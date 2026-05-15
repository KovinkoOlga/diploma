import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";

export default function ListRow({ icon, title, subtitle, value, onPress, danger = false }) {
  const { colors, typography, spacing } = useAppTheme();
  const textColor = danger ? colors.danger : colors.text;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.row, { borderBottomColor: colors.divider, paddingVertical: spacing.md }]}>
        {icon ? <Ionicons name={icon} size={18} color={textColor} style={{ marginRight: spacing.sm }} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[typography.cardTitle, { color: textColor }]}>{title}</Text>
          {subtitle ? <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 2 }]}>{subtitle}</Text> : null}
        </View>
        {value ? <Text style={[typography.meta, { color: colors.secondaryText, marginRight: 8 }]}>{value}</Text> : null}
        {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.secondaryText} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
