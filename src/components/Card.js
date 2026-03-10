import React from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";

export default function Card({ children, style, variant = "paper" }) {
  const theme = useAppTheme();
  const { colors, radius, shadows } = theme;

  return (
    <View
      style={[
        styles.base,
        variant === "flat"
          ? { backgroundColor: "transparent", borderColor: colors.divider, borderRadius: radius.md }
          : { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.md, ...shadows.card },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
