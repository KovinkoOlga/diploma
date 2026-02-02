import React, { useLayoutEffect, useMemo } from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import Card from "../../components/Card";
import Chip from "../../components/Chip";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";

export default function PostDetailsScreen({ navigation, route }) {
  const { colors, spacing, typography } = useAppTheme();
  const { feedPosts } = useWardrobe();
  const postId = route.params?.postId;
  const post = useMemo(() => feedPosts.find((p) => p.id === postId), [feedPosts, postId]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: post?.author ?? "Пост" });
  }, [navigation, post?.author]);

  if (!post) {
    return (
      <Screen>
        <View style={{ padding: spacing.md }}>
          <Text style={{ color: colors.text }}>Пост не найден.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ padding: spacing.md }}>
        <Card style={{ padding: spacing.md }} variant="flat">
          <Text style={[typography.h3, { color: colors.text }]}>{post.author}</Text>
          <Text style={[typography.body, { marginTop: 10, color: colors.text }]}>{post.text}</Text>
          <Text style={[typography.caption, { marginTop: 10, color: colors.mutedText, letterSpacing: 0.6 }]}>
            {post.likes} лайков
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md }}>
            {(post.tags ?? []).map((t) => (
              <Chip key={t} label={t} />
            ))}
          </View>
        </Card>
      </View>
    </Screen>
  );
}
