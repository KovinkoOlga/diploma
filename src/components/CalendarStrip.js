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
  const { colors, radius, spacing, typography } = useAppTheme();
  const data = buildNextDays(7);

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={data}
      keyExtractor={(it) => it.key}
      contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
      renderItem={({ item }) => {
        const selected = item.key === selectedKey;
        return (
          <Pressable
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [
              styles.tile,
              {
                borderRadius: radius.md,
                backgroundColor: selected ? colors.accentSoft : colors.surface,
                borderColor: selected ? colors.accent : colors.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Text
              style={[
                typography.small,
                {
                  color: selected ? colors.text : colors.mutedText,
                  textTransform: "capitalize",
                  letterSpacing: 0.6,
                },
              ]}
            >
              {item.dayLabel}
            </Text>
            <Text
              style={[
                typography.h3,
                {
                  marginTop: 2,
                  color: colors.text,
                },
              ]}
            >
              {item.dayNumber}
            </Text>
          </Pressable>
        );
      }}
      ListFooterComponent={<View style={{ width: spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 66,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
