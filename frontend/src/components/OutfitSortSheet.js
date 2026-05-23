import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";
import { OUTFIT_SORT_OPTIONS } from "../utils/outfits";
import SheetModal from "./SheetModal";

export default function OutfitSortSheet({ visible, onClose, sortBy, onChangeSort }) {
  const { colors, typography, spacing, radius } = useAppTheme();

  return (
    <SheetModal visible={visible} onClose={onClose} title="Сортировка">
      <View style={{ gap: spacing.sm }}>
        {OUTFIT_SORT_OPTIONS.map((option) => {
          const selected = option.id === sortBy;

          return (
            <Pressable
              key={option.id}
              onPress={() => {
                onChangeSort(option.id);
                onClose();
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.82 : 1 }]}
            >
              <View
                style={{
                  borderWidth: 1,
                  borderColor: selected ? colors.text : colors.border,
                  borderRadius: radius.lg,
                  backgroundColor: colors.secondaryBackground,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={[typography.body, { color: colors.text }]}>{option.title}</Text>
                {selected ? <Ionicons name="checkmark" size={18} color={colors.text} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </SheetModal>
  );
}
