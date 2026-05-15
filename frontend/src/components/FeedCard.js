import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";
import MediaPreview from "./MediaPreview";

export default function FeedCard({
  eyebrow,
  title,
  summary,
  meta,
  image,
  onPress,
  actionLabel,
  onActionPress,
}) {
  const { colors, typography, radius, spacing } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <View style={[styles.card, { borderColor: colors.divider, borderRadius: radius.lg }]}>
        <MediaPreview source={image} containerStyle={[styles.image, { backgroundColor: colors.secondaryBackground }]} />
        <View style={{ padding: spacing.md }}>
          <Text style={[typography.meta, { color: colors.secondaryText }]}>{eyebrow}</Text>
          <Text style={[typography.sectionTitle, { color: colors.text, marginTop: 6 }]}>{title}</Text>
          <Text style={[typography.body, { color: colors.secondaryText, marginTop: 6 }]} numberOfLines={3}>
            {summary}
          </Text>
          <View style={styles.footer}>
            <Text style={[typography.meta, { color: colors.tertiaryText }]}>{meta}</Text>
            {actionLabel ? (
              <Pressable onPress={onActionPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View style={styles.inlineAction}>
                  <Text style={[typography.meta, { color: colors.text }]}>{actionLabel}</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.text} />
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: {
    width: "100%",
    aspectRatio: 1.18,
  },
  footer: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inlineAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
