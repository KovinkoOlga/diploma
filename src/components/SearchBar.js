import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";

export default function SearchBar({ value, onChangeText, placeholder = "Поиск" }) {
  const { colors, radius, spacing, typography } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: spacing.md,
        height: 46,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <Ionicons name="search-outline" size={18} color={colors.mutedText} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedText}
        style={[typography.body, { flex: 1, color: colors.text }]}
        returnKeyType="search"
      />
    </View>
  );
}
