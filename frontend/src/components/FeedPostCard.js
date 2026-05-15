import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Chip from "./Chip";
import { useAppTheme } from "../theme/ThemeProvider";

export default function FeedPostCard({ post, coverImage, onPress, onToggleSaved }) {
  const { colors, spacing, typography, radius } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.55 : 1 }]}>
      <View style={[styles.wrap, { borderColor: colors.divider, borderRadius: radius.md }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={[typography.sectionTitle, { color: colors.text }]} numberOfLines={1}>
              {post.author}
            </Text>
            <Text style={[typography.caption, { marginTop: 2, color: colors.mutedText }]}>{post.likes} лайков</Text>
          </View>

          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleSaved?.();
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.55 : 1, padding: 6 }]}
          >
            <Ionicons name={post.saved ? "bookmark" : "bookmark-outline"} size={20} color={colors.mutedText} />
          </Pressable>
        </View>

        <Text style={[typography.body, { marginTop: spacing.sm, color: colors.text }]} numberOfLines={4}>
          {post.text}
        </Text>

        <View style={{ marginTop: spacing.md }}>
          {coverImage ? (
            <Image source={coverImage} style={[styles.media, { backgroundColor: colors.card2 }]} />
          ) : (
            <View style={[styles.media, { backgroundColor: colors.card2, borderColor: colors.border }]}>
              <Ionicons name="images-outline" size={18} color={colors.mutedText} />
            </View>
          )}
        </View>

        {(post.tags ?? []).length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.sm }}>
            {(post.tags ?? []).slice(0, 4).map((t) => (
              <Chip key={t} label={t} />
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.md }}>
          <Ionicons name="heart-outline" size={20} color={colors.mutedText} />
          <Text style={[typography.caption, { marginLeft: 6, color: colors.mutedText }]}>Нравится</Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  media: {
    height: 220,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
