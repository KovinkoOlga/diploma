import React, { useMemo, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import Screen, { useScreenContentInsets } from "../../components/Screen";
import AppHeader from "../../components/AppHeader";
import SearchBar from "../../components/SearchBar";
import Chip from "../../components/Chip";
import NewsCard from "../../components/NewsCard";
import EmptyState from "../../components/EmptyState";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

const filterChips = ["office", "classic", "casual", "warm", "evening", "summer", "winter"];

export default function FeedHomeScreen({ navigation }) {
  const { spacing, layout } = useAppTheme();
  const { bottom } = useScreenContentInsets(12);
  const { feedPosts, outfits, items, actions } = useWardrobe();
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState(null);

  const outfitById = useMemo(() => Object.fromEntries(outfits.map((outfit) => [outfit.id, outfit])), [outfits]);
  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return feedPosts.filter((post) => {
      if (activeTag && !(post.tags ?? []).includes(activeTag)) return false;
      if (!normalized) return true;

      return [post.author, post.source, post.title, post.text, post.category]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [activeTag, feedPosts, query]);

  return (
    <Screen header={<AppHeader title="Новости" subtitle="сегодняшние подборки" right={null} />}>
      <FlatList
        data={filtered}
        keyExtractor={(post) => post.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom, paddingHorizontal: layout.screenPadding }}
        ListHeaderComponent={
          <View style={{ paddingTop: spacing.sm }}>
            <SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery("")} placeholder="Поиск по новостям и подборкам" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: spacing.sm }}
            >
              {filterChips.map((tag) => (
                <Chip key={tag} label={tag} selected={activeTag === tag} onPress={() => setActiveTag((prev) => (prev === tag ? null : tag))} />
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => {
          const outfit = item.outfitId ? outfitById[item.outfitId] : null;
          const image = outfit?.itemIds?.[0] ? itemById[outfit.itemIds[0]]?.image : items[0]?.image;

          return (
            <NewsCard
              post={item}
              image={image}
              onToggleSaved={() => actions.togglePostSaved(item.id)}
              onPress={() => navigation.navigate(Routes.PostDetails, { postId: item.id })}
            />
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="Ничего не найдено"
            subtitle="Попробуйте убрать фильтр или изменить запрос."
          />
        }
      />
    </Screen>
  );
}
