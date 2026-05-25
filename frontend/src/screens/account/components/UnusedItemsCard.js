import React from "react";
import { ScrollView, Text, View } from "react-native";
import Card from "../../../components/Card";
import ActionButton from "../../../components/ActionButton";
import EmptyState from "../../../components/EmptyState";
import { useAppTheme } from "../../../theme/ThemeProvider";
import HistogramChart from "./HistogramChart";
import HorizontalItemStatsCard from "./HorizontalItemStatsCard";

export default function UnusedItemsCard({
  allPeriodSelected = false,
  unusedItems = [],
  previewItems = [],
  histogramData = [],
  itemSubtitleById = {},
  onOpenItem,
  onOpenAll,
  borderStyle,
}) {
  const { colors, typography, spacing } = useAppTheme();
  const title = allPeriodSelected
    ? `${unusedItems.length} вещей не использовались за всё время`
    : `${unusedItems.length} вещей не использовались в выбранном периоде`;

  return (
    <Card style={{ padding: spacing.md, ...borderStyle }}>
      <Text style={[typography.sectionTitle, { color: colors.text }]}>Давно не носили</Text>
      <Text style={[typography.body, { color: colors.secondaryText, marginTop: 6 }]}>{title}</Text>

      {unusedItems.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md }}>
          {previewItems.map((item) => (
            <HorizontalItemStatsCard
              key={item.id}
              item={item}
              subtitle={itemSubtitleById[item.id] ?? item.subcategory ?? "Вещь"}
              meta="Не отмечалась"
              onPress={() => onOpenItem(item.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={{ marginTop: spacing.md }}>
          <EmptyState
            icon="checkmark-circle-outline"
            title="Все подходящие вещи уже использовались"
            subtitle="График ниже всё равно показывает полный список категорий с нулевыми значениями."
          />
        </View>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <HistogramChart data={histogramData} orientation="horizontal" />
      </View>

      <ActionButton label="Посмотреть все" variant="secondary" onPress={onOpenAll} style={{ marginTop: spacing.lg }} fullWidth />
    </Card>
  );
}
