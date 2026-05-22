import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";
import MediaPreview from "./MediaPreview";
import CategoryIcon from "./CategoryIcon";

export default function WardrobeItemCard({
  item,
  category,
  onPress,
  onLongPress,
  selectionMode = false,
  selected = false,
}) {
  const { colors, typography, spacing, radius } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.9 : 1 }]}
    >
      <View
        style={[
          styles.gridCard,
          {
            borderColor: selected ? colors.text : colors.border,
            borderRadius: radius.lg,
            backgroundColor: colors.secondaryBackground,
            padding: spacing.sm,
          },
        ]}
      >
        <View style={{ position: "relative" }}>
          <MediaPreview
            source={item.image}
            containerStyle={{
              width: "100%",
              aspectRatio: 0.86,
              borderRadius: radius.md,
              backgroundColor: colors.background,
            }}
            placeholderScale={0.5}
          />
          <View
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.88)",
            }}
          >
            {selectionMode ? (
              <Ionicons
                name={selected ? "checkmark-circle" : "ellipse-outline"}
                size={16}
                color={selected ? colors.text : colors.secondaryText}
              />
            ) : (
              <CategoryIcon categoryId={category?.id} icon={category?.icon} size={16} color={colors.text} />
            )}
          </View>
        </View>
        <Text style={[typography.cardTitle, { color: colors.text, marginTop: 10 }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 4 }]} numberOfLines={1}>
          {item.subcategory || "Без подкатегории"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gridCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
