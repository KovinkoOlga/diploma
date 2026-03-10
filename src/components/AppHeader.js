import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../theme/ThemeProvider";

export default function AppHeader({ title, subtitle, left, right, bordered = true }) {
  const { colors, typography, spacing, layout } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + 6,
          paddingHorizontal: layout.screenPadding,
          paddingBottom: spacing.sm,
          borderBottomColor: colors.divider,
          borderBottomWidth: bordered ? StyleSheet.hairlineWidth : 0,
          backgroundColor: colors.background,
        },
      ]}
    >
      <View style={styles.side}>{left}</View>
      <View style={styles.center}>
        <Text numberOfLines={1} style={[typography.headerTitle, { color: colors.text, textAlign: "center" }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[typography.meta, { color: colors.tertiaryText, marginTop: 1 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  side: {
    minWidth: 60,
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  right: {
    alignItems: "flex-end",
  },
});
