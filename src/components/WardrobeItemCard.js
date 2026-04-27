import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";
import MediaPreview from "./MediaPreview";

function TinyAction({ icon, onPress, color, backgroundColor }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={color} />
    </Pressable>
  );
}

export default function WardrobeItemCard({
  item,
  category,
  onPress,
  onLongPress,
  onAddToOutfit,
  onDelete,
  variant = "grid",
  selectionMode = false,
  selected = false,
  showActions = false,
}) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const tags = item.styles ?? item.tags ?? [];
  const metaText = [item.subcategory, item.brand].filter(Boolean).join(" · ");

  if (variant === "list") {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
        <View
          style={[
            styles.listCard,
            {
              borderColor: selected ? colors.text : colors.border,
              borderRadius: radius.lg,
              backgroundColor: colors.secondaryBackground,
              padding: spacing.sm,
            },
          ]}
        >
          <MediaPreview
            source={item.image}
            containerStyle={{
              width: 84,
              height: 84,
              borderRadius: radius.md,
              backgroundColor: colors.background,
            }}
            placeholderScale={0.5}
          />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={[typography.cardTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 4 }]} numberOfLines={1}>
                  {metaText || item.colors?.join(", ") || "Без атрибутов"}
                </Text>
              </View>
              {selectionMode ? (
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={selected ? colors.text : colors.secondaryText}
                />
              ) : category?.icon ? (
                <Ionicons name={category.icon} size={18} color={colors.secondaryText} />
              ) : null}
            </View>
            <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 8 }]} numberOfLines={1}>
              {[...(item.colors ?? []).slice(0, 1), ...(tags ?? []).slice(0, 2)].join(" · ")}
            </Text>
            {!selectionMode && showActions ? (
              <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.sm }}>
                <TinyAction
                  icon="sparkles-outline"
                  onPress={onAddToOutfit}
                  color={colors.text}
                  backgroundColor={colors.background}
                />
                <TinyAction
                  icon="trash-outline"
                  onPress={onDelete}
                  color={colors.danger}
                  backgroundColor={colors.dangerSoft}
                />
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  }

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
            <Ionicons
              name={
                selectionMode
                  ? selected
                    ? "checkmark-circle"
                    : "ellipse-outline"
                  : category?.icon ?? "shirt-outline"
              }
              size={16}
              color={selectionMode && !selected ? colors.secondaryText : colors.text}
            />
          </View>
        </View>
        <Text style={[typography.cardTitle, { color: colors.text, marginTop: 10 }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 4 }]} numberOfLines={1}>
          {metaText || item.colors?.[0] || "Без атрибутов"}
        </Text>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 4 }]} numberOfLines={1}>
          {[...(item.colors ?? []).slice(0, 1), ...(tags ?? []).slice(0, 2)].join(" · ")}
        </Text>
        {!selectionMode && showActions ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
            <TinyAction icon="open-outline" onPress={onPress} color={colors.text} backgroundColor={colors.background} />
            <TinyAction
              icon="sparkles-outline"
              onPress={onAddToOutfit}
              color={colors.text}
              backgroundColor={colors.background}
            />
            <TinyAction
              icon="trash-outline"
              onPress={onDelete}
              color={colors.danger}
              backgroundColor={colors.dangerSoft}
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listCard: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
  },
  gridCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
