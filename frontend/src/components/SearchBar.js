import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";

export default function SearchBar({
  value,
  onChangeText,
  placeholder = "Поиск",
  onSubmitEditing,
  onClear,
}) {
  const { colors, spacing, radius } = useAppTheme();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.inputBackground,
          borderColor: colors.inputBorder,
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
        },
      ]}
    >
      <Ionicons name="search" size={16} color={colors.secondaryText} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.secondaryText}
        style={[styles.input, { color: colors.text }]}
        onSubmitEditing={onSubmitEditing}
      />
      {value ? (
        <Pressable onPress={onClear} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Ionicons name="close-circle" size={16} color={colors.secondaryText} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    paddingVertical: 0,
  },
});
