import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";

export default function FAB({ onPress, icon = "add", size = 62, iconSize = 28, style }) {
  const { colors, radius } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          opacity: pressed ? 0.85 : 1,
          backgroundColor: colors.text,
          borderColor: colors.text,
          borderRadius: radius.pill,
          width: size,
          height: size,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.2,
          shadowRadius: 18,
          elevation: 10,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={colors.background} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: "absolute",
    right: 16,
    bottom: 88,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
});
