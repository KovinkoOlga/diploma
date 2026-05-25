import React from "react";
import { ScrollView, Text, View } from "react-native";
import Card from "../../../components/Card";
import EmptyState from "../../../components/EmptyState";
import { useAppTheme } from "../../../theme/ThemeProvider";
import HorizontalItemStatsCard from "./HorizontalItemStatsCard";
import HorizontalOutfitStatsCard from "./HorizontalOutfitStatsCard";

function formatWearCount(count) {
  const suffix = count % 10 === 1 && count % 100 !== 11 ? "раз" : "раз";
  return `${count} ${suffix}`;
}

export default function TopWearCard({
  topItems = [],
  topOutfits = [],
  itemSubtitleById = {},
  outfitSubtitleById = {},
  outfitImageById = {},
  onOpenItem,
  onOpenOutfit,
  borderStyle,
}) {
  const { colors, typography, spacing } = useAppTheme();

  return (
    <Card style={{ paddingVertical: spacing.md, ...borderStyle }}>
      <View style={{ paddingHorizontal: spacing.md }}>
        <Text style={[typography.sectionTitle, { color: colors.text }]}>Часто носите</Text>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <View style={{ paddingHorizontal: spacing.md }}>
          <Text style={[typography.cardTitle, { color: colors.text }]}>Топ вещей</Text>
        </View>
        {topItems.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm }}
          >
            {topItems.map(({ item, wearCount }) => (
              <HorizontalItemStatsCard
                key={item.id}
                item={item}
                subtitle={itemSubtitleById[item.id] ?? item.subcategory ?? "Вещь"}
                meta={formatWearCount(wearCount)}
                onPress={() => onOpenItem(item.id)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
            <EmptyState
              icon="shirt-outline"
              title="Пока нет данных по вещам"
              subtitle="В выбранном периоде пока нет часто используемых вещей."
            />
          </View>
        )}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <View style={{ paddingHorizontal: spacing.md }}>
          <Text style={[typography.cardTitle, { color: colors.text }]}>Топ образов</Text>
        </View>
        {topOutfits.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm }}
          >
            {topOutfits.map(({ outfit, wearCount }) => (
              <HorizontalOutfitStatsCard
                key={outfit.id}
                outfit={outfit}
                imageSource={outfitImageById[outfit.id]}
                subtitle={outfitSubtitleById[outfit.id] ?? "Образ"}
                meta={formatWearCount(wearCount)}
                onPress={() => onOpenOutfit(outfit.id)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
            <EmptyState
              icon="bookmark-outline"
              title="Пока нет данных по образам"
              subtitle="В выбранном периоде пока нет часто используемых образов."
            />
          </View>
        )}
      </View>
    </Card>
  );
}
