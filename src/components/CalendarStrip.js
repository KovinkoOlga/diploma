import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import { addDays, formatDayNumber, formatShortRuDay, toISODate } from "../utils/formatDate";

function buildNextDays(count = 7) {
  const base = new Date();
  return Array.from({ length: count }).map((_, idx) => {
    const date = addDays(base, idx);
    return {
      key: toISODate(date),
      date,
      dayLabel: formatShortRuDay(date),
      dayNumber: formatDayNumber(date),
    };
  });
}

export default function CalendarStrip({ selectedKey, onSelect }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const data = buildNextDays(7);

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={data}
      keyExtractor={(it) => it.key}
      contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.md }}
      renderItem={({ item }) => {
        const selected = item.key === selectedKey;
        return (
          <Pressable onPress={() => onSelect(item.key)} style={({ pressed }) => [{ opacity: pressed ? 0.55 : 1 }]}>
            <View
              style={[
                styles.item,
                {
                  backgroundColor: selected ? colors.text : colors.bg2 ?? colors.card2,
                  borderColor: selected ? colors.text : colors.border,
                  borderRadius: radius.md,
                },
              ]}
            >
              <Text style={[typography.caption, { color: selected ? colors.bg : colors.mutedText }]}>
                {item.dayLabel}
              </Text>
              <Text style={[typography.h3, { marginTop: 4, color: selected ? colors.bg : colors.text }]}>
                {item.dayNumber}
              </Text>
            </View>
          </Pressable>
        );
      }}
      ListFooterComponent={<View style={{ width: spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  item: {
    minWidth: 64,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
