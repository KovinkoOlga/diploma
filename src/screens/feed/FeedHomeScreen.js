import React, { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import Screen from "../../components/Screen";
import SectionHeader from "../../components/SectionHeader";
import Chip from "../../components/Chip";
import SearchBar from "../../components/SearchBar";
import FeedPostCard from "../../components/FeedPostCard";
import EmptyState from "../../components/EmptyState";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

const filterChips = ["casual", "office", "sport", "classic", "warm", "evening", "summer", "winter"];

export default function FeedHomeScreen({ navigation }) {
  const { spacing } = useAppTheme();
  const { feedPosts, outfits, actions } = useWardrobe();

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState(null);

  const outfitById = useMemo(() => Object.fromEntries(outfits.map((o) => [o.id, o])), [outfits]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feedPosts.filter((p) => {
      if (activeTag && !(p.tags ?? []).includes(activeTag)) return false;
      if (!q) return true;
      const outfitTitle = p.outfitId ? outfitById[p.outfitId]?.title ?? "" : "";
      return (
        p.author.toLowerCase().includes(q) ||
        p.text.toLowerCase().includes(q) ||
        outfitTitle.toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [feedPosts, query, activeTag, outfitById]);

  return (
    <Screen>
      <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Поиск по ленте" />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
          {filterChips.map((t) => (
            <Chip
              key={t}
              label={t}
              selected={activeTag === t}
              onPress={() => setActiveTag((prev) => (prev === t ? null : t))}
            />
          ))}
        </View>

        <SectionHeader title={`Посты · ${filtered.length}`} />
        {filtered.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="Ничего не найдено"
            subtitle="Попробуйте другой запрос или уберите фильтр."
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: 160 }}
            renderItem={({ item }) => (
              <FeedPostCard
                post={item}
                onToggleSaved={() => actions.togglePostSaved(item.id)}
                onPress={() => navigation.navigate(Routes.PostDetails, { postId: item.id })}
              />
            )}
          />
        )}
      </View>
    </Screen>
  );
}

