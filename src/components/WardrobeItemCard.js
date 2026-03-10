import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import Chip from "./Chip";
import MediaPreview from "./MediaPreview";

export default function WardrobeItemCard({ item, onPress, variant = "grid" }) {
  const { colors, typography, spacing, radius } = useAppTheme();

  if (variant === "list") {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
        <View style={[styles.listCard, { borderBottomColor: colors.divider, paddingVertical: spacing.sm }]}>
          <MediaPreview source={item.image} containerStyle={[styles.listImage, { backgroundColor: colors.secondaryBackground, borderRadius: radius.md }]} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typography.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 4 }]} numberOfLines={1}>
              {[item.brand, item.colors?.[0]].filter(Boolean).join(" · ")}
            </Text>
            <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {(item.tags ?? []).slice(0, 2).map((tag) => (
                <Chip key={tag} label={tag} compact />
              ))}
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.9 : 1 }]}>
      <View>
        <MediaPreview source={item.image} containerStyle={[styles.gridImage, { backgroundColor: colors.secondaryBackground, borderRadius: radius.lg }]} />
        <Text style={[typography.cardTitle, { color: colors.text, marginTop: 10 }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 3 }]} numberOfLines={1}>
          {[item.brand, item.colors?.[0]].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listImage: {
    width: 72,
    height: 72,
  },
  gridImage: {
    width: "100%",
    aspectRatio: 0.82,
  },
});
