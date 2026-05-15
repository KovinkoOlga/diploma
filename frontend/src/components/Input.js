import React from "react";
import { StyleSheet, TextInput } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";

export default function Input({ style, multiline = false, ...props }) {
  const { colors, typography, radius, spacing } = useAppTheme();

  return (
    <TextInput
      multiline={multiline}
      placeholderTextColor={colors.secondaryText}
      style={[
        styles.input,
        typography.body,
        {
          minHeight: multiline ? 96 : 44,
          backgroundColor: colors.inputBackground,
          borderColor: colors.inputBorder,
          borderRadius: radius.md,
          color: colors.text,
          paddingHorizontal: spacing.sm,
          paddingVertical: multiline ? spacing.sm : 0,
          textAlignVertical: multiline ? "top" : "center",
        },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
