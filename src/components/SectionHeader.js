import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";

export default function SectionHeader({ title, right }) {
  const { colors, spacing, typography } = useAppTheme();
  return (
    <View style={[styles.wrap, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>
      <View style={styles.row}>
        <Text style={[typography.h3, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {right ? <View style={{ marginLeft: spacing.sm }}>{right}</View> : null}
      </View>
      <View style={[styles.rule, { borderBottomColor: colors.divider }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rule: { marginTop: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderStyle: "dashed" },
});
