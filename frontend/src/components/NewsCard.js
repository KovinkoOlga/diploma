import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";
import Avatar from "./Avatar";
import MediaPreview from "./MediaPreview";

export default function NewsCard({ post, image, onPress, onToggleSaved }) {
  const { colors, typography, spacing } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}>
      <View style={[styles.card, { borderBottomColor: colors.divider, paddingVertical: spacing.md }]}>
        <View style={styles.topRow}>
          <View style={styles.authorRow}>
            <Avatar size={32} label={post.author} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={[typography.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {post.author}
              </Text>
              <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 2 }]} numberOfLines={1}>
                {post.source} · {post.timeAgo}
              </Text>
            </View>
          </View>
          <Pressable onPress={onToggleSaved} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name={post.saved ? "bookmark" : "bookmark-outline"} size={20} color={colors.text} />
          </Pressable>
        </View>

        <MediaPreview source={image} containerStyle={[styles.image, { backgroundColor: colors.secondaryBackground }]} />

        <Text style={[typography.cardTitle, { color: colors.text, marginTop: spacing.sm }]}>{post.title}</Text>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: 6 }]} numberOfLines={3}>
          {post.text}
        </Text>

        <View style={[styles.bottomRow, { marginTop: spacing.sm }]}>
          <Text style={[typography.meta, { color: colors.secondaryText }]} numberOfLines={1}>
            {post.category} · {post.likes} лайков
          </Text>
          <View style={styles.actions}>
            <Ionicons name="heart-outline" size={18} color={colors.text} />
            <Ionicons name="paper-plane-outline" size={18} color={colors.text} />
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 18,
    marginTop: 12,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
