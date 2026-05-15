import React, { useLayoutEffect, useMemo } from "react";
import { View } from "react-native";
import Screen from "../../components/Screen";
import FeedCard from "../../components/FeedCard";
import SectionHeader from "../../components/SectionHeader";
import Chip from "../../components/Chip";
import ActionButton from "../../components/ActionButton";
import EmptyState from "../../components/EmptyState";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function PostDetailsScreen({ navigation, route }) {
  const { spacing } = useAppTheme();
  const { feedPosts, outfits, items } = useWardrobe();
  const post = useMemo(() => feedPosts.find((entry) => entry.id === route.params?.postId), [feedPosts, route.params?.postId]);
  const outfit = useMemo(() => outfits.find((entry) => entry.id === post?.outfitId), [outfits, post?.outfitId]);
  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const cover = outfit?.itemIds?.[0] ? itemById[outfit.itemIds[0]]?.image : items[0]?.image;

  useLayoutEffect(() => {
    navigation.setOptions({ title: post?.author ?? "Публикация" });
  }, [navigation, post?.author]);

  if (!post) {
    return (
      <Screen padded>
        <EmptyState icon="alert-circle-outline" title="Публикация не найдена" subtitle="Вернитесь к ленте и выберите другую карточку." />
      </Screen>
    );
  }

  return (
    <Screen scroll padded>
      <FeedCard
        eyebrow={`${post.category} · ${post.source}`}
        title={post.title}
        summary={post.text}
        meta={`${post.likes} лайков · ${post.timeAgo}`}
        image={cover}
      />

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Теги" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
          {(post.tags ?? []).map((tag) => (
            <Chip key={tag} label={tag} />
          ))}
        </View>
      </View>

      {outfit ? (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Связанный образ" />
          <ActionButton
            label="Открыть образ"
            icon="arrow-forward-outline"
            variant="secondary"
            onPress={() => navigation.navigate("OutfitsTab", { screen: Routes.OutfitDetails, params: { outfitId: outfit.id } })}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      ) : null}
    </Screen>
  );
}
