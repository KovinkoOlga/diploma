import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Chip from "./Chip";
import { useAppTheme } from "../theme/ThemeProvider";

export default function ItemCard({ item, onPress, variant = "row" }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const metaText = [item.subcategory, item.brand].filter(Boolean).join(" · ");

  if (variant === "grid") {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
        <View style={[styles.gridWrap, { borderColor: colors.divider, borderRadius: radius.md }]}>
          <Image source={item.image} style={[styles.gridImage, { backgroundColor: colors.card2 }]} />
          <View style={{ padding: spacing.sm }}>
            <Text style={[typography.sectionTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[typography.caption, { marginTop: 2, color: colors.mutedText }]} numberOfLines={1}>
              {metaText || "—"}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.55 : 1 }]}>
      <View style={[styles.row, { borderBottomColor: colors.divider, paddingVertical: spacing.sm }]}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Text style={[typography.h3, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[typography.caption, { marginTop: 2, color: colors.mutedText }]} numberOfLines={1}>
            {metaText || "—"} · {item.season?.join(", ") ?? "—"}
          </Text>
          {(item.tags ?? []).length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.xs }}>
              {(item.tags ?? []).slice(0, 3).map((t) => (
                <Chip key={t} label={t} />
              ))}
            </View>
          ) : null}
        </View>

        <Image
          source={item.image}
          style={[
            styles.thumb,
            { backgroundColor: colors.card2, borderColor: colors.border, borderRadius: radius.sm },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 54,
    height: 54,
    borderWidth: StyleSheet.hairlineWidth,
  },
  gridWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  gridImage: {
    width: "100%",
    aspectRatio: 1,
  },
});
