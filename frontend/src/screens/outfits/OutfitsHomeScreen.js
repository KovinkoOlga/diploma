import React, { useMemo, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import Screen, { useScreenContentInsets } from "../../components/Screen";
import AppHeader from "../../components/AppHeader";
import ActionButton from "../../components/ActionButton";
import Chip from "../../components/Chip";
import OutfitCard from "../../components/OutfitCard";
import EmptyState from "../../components/EmptyState";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function OutfitsHomeScreen({ navigation }) {
  const { spacing, layout } = useAppTheme();
  const { bottom } = useScreenContentInsets(12);
  const { outfits, items } = useWardrobe();
  const [activeTag, setActiveTag] = useState("all");

  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const allTags = useMemo(() => ["all", ...new Set(outfits.flatMap((outfit) => outfit.tags ?? []))], [outfits]);
  const filteredOutfits = useMemo(() => {
    if (activeTag === "all") return outfits;
    return outfits.filter((outfit) => (outfit.tags ?? []).includes(activeTag));
  }, [activeTag, outfits]);

  return (
    <Screen
      header={
        <AppHeader
          title="Образы"
          subtitle="сохраненные подборки"
          right={<ActionButton icon="add-outline" compact variant="ghost" onPress={() => navigation.navigate(Routes.OutfitEditor)} />}
        />
      }
    >
      <FlatList
        data={filteredOutfits}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{ paddingBottom: bottom, paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm }}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: spacing.sm }}>
            {allTags.map((tag) => (
              <Chip key={tag} label={tag === "all" ? "Все" : tag} selected={activeTag === tag} onPress={() => setActiveTag(tag)} />
            ))}
          </ScrollView>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <OutfitCard
              outfit={item}
              items={item.itemIds.map((id) => itemById[id]).filter(Boolean)}
              onPress={() => navigation.navigate(Routes.OutfitDetails, { outfitId: item.id })}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <EmptyState
            icon="bookmark-outline"
            title="Пока нет образов"
            subtitle="Соберите первый образ из вещей вашего шкафа."
            actionLabel="Создать"
            onAction={() => navigation.navigate(Routes.OutfitEditor)}
          />
        }
      />
    </Screen>
  );
}
