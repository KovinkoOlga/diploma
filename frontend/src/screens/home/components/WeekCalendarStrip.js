import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../../theme/ThemeProvider";
import { buildWeekDays } from "../../../utils/calendar";

export default function WeekCalendarStrip({ entriesByDate = {}, onSelectDate, selectedDate }) {
  const { colors, spacing, radius, typography } = useAppTheme();
  const days = buildWeekDays(new Date());

  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {days.map((day) => {
        const entry = entriesByDate[day.key];
        const selected = selectedDate === day.key;
        const hasContent = Boolean(entry?.hasContent || entry?.outfit || entry?.items?.length);
        return (
          <Pressable
            key={day.key}
            onPress={() => onSelectDate?.(day.key)}
            style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.72 : 1 }]}
          >
            <View
              style={{
                minHeight: 88,
                paddingVertical: spacing.sm,
                paddingHorizontal: 4,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: selected ? colors.text : colors.border,
                backgroundColor: selected ? colors.text : colors.secondaryBackground,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={[typography.caption, { color: selected ? colors.background : colors.secondaryText }]}>
                {day.label}
              </Text>
              <Text style={[typography.sectionTitle, { color: selected ? colors.background : colors.text }]}>
                {day.date.getDate()}
              </Text>
              <View style={{ minHeight: 18, justifyContent: "center" }}>
                {hasContent ? (
                  <Ionicons name="checkmark-circle" size={16} color={selected ? colors.background : colors.text} />
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
