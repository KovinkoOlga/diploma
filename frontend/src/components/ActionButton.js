import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";

const variantStyles = {
  primary: "primary",
  secondary: "secondary",
  ghost: "ghost",
  danger: "danger",
};

export default function ActionButton({
  label,
  icon,
  onPress,
  variant = "primary",
  compact = false,
  fullWidth = false,
  disabled = false,
  style,
}) {
  const { colors, typography, radius, spacing } = useAppTheme();

  const palette = {
    primary: {
      backgroundColor: colors.text,
      borderColor: colors.text,
      textColor: colors.background,
    },
    secondary: {
      backgroundColor: colors.secondaryBackground,
      borderColor: colors.border,
      textColor: colors.text,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      textColor: colors.text,
    },
    danger: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.dangerSoft,
      textColor: colors.danger,
    },
  }[variantStyles[variant] ?? "primary"];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        {
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      <View
        style={[
          styles.button,
          {
            minHeight: compact ? 34 : 42,
            paddingHorizontal: compact ? spacing.sm : spacing.md,
            borderRadius: compact ? radius.pill : radius.md,
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor,
          },
        ]}
      >
        {icon ? <Ionicons name={icon} size={compact ? 15 : 17} color={palette.textColor} /> : null}
        {label ? (
          <Text
            style={[
              typography.button,
              {
                color: palette.textColor,
                marginLeft: icon ? 8 : 0,
              },
            ]}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: "flex-start",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
