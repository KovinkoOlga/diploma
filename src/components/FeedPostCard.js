import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Card from "./Card";
import Chip from "./Chip";
import { useAppTheme } from "../theme/ThemeProvider";

export default function FeedPostCard({ post, onPress, onToggleSaved }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.95 : 1 }]}>
      <Card style={{ padding: spacing.md }} variant="flat">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={[typography.body, { color: colors.text, fontWeight: typography.weights.medium }]}>
              {post.author}
            </Text>
            <Text style={[typography.small, { marginTop: 2, color: colors.mutedText, letterSpacing: 0.6 }]}>
              {post.likes} лайков
            </Text>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleSaved?.();
            }}
            style={({ pressed }) => [
              {
                width: 40,
                height: 40,
                borderRadius: radius.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.chipBg,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Ionicons name={post.saved ? "bookmark" : "bookmark-outline"} size={18} color={colors.icon} />
          </Pressable>
        </View>

        <Text style={[typography.body, { marginTop: spacing.sm, color: colors.text }]}>{post.text}</Text>

        <View
          style={{
            marginTop: spacing.md,
            height: 120,
            borderRadius: radius.md,
            backgroundColor: colors.card2,
            borderWidth: 1,
            borderColor: colors.border,
            borderStyle: "dashed",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="images-outline" size={22} color={colors.mutedText} />
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
          {(post.tags ?? []).slice(0, 4).map((t) => (
            <Chip key={t} label={t} />
          ))}
        </View>
      </Card>
    </Pressable>
  );
}
