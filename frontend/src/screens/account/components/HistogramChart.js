import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useAppTheme } from "../../../theme/ThemeProvider";

export default function HistogramChart({
  data = [],
  height = 144,
  minBarWidth = 18,
  scrollable = false,
  compactLabels = false,
  orientation = "vertical",
  fillWidth = false,
}) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const maxValue = Math.max(...data.map((entry) => entry.value), 0);

  if (orientation === "horizontal") {
    return (
      <View style={{ gap: spacing.sm }}>
        {data.map((entry) => {
          const widthPercent = maxValue ? Math.max(4, (entry.value / maxValue) * 100) : 4;
          return (
            <View key={entry.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.text, width: 92 }]} numberOfLines={2}>
                {entry.label}
              </Text>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View
                  style={{
                    flex: 1,
                    height: 12,
                    borderRadius: radius.pill,
                    backgroundColor: colors.accentSoft,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${widthPercent}%`,
                      minWidth: 6,
                      height: "100%",
                      borderRadius: radius.pill,
                      backgroundColor: entry.highlight ? colors.text : colors.tertiaryText,
                    }}
                  />
                </View>
                <Text style={[typography.caption, { color: colors.secondaryText, width: 24, textAlign: "right", fontVariant: ["tabular-nums"] }]}>
                  {entry.value}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: fillWidth ? "space-between" : "flex-start",
        gap: fillWidth ? 0 : 10,
        minHeight: height + 34,
        width: fillWidth ? "100%" : undefined,
      }}
    >
      {data.map((entry, index) => {
        const barHeight = maxValue ? Math.max(8, (entry.value / maxValue) * height) : 8;
        const shouldShowSecondary = !compactLabels || data.length <= 8 || index % Math.ceil(data.length / 6) === 0 || index === data.length - 1;

        return (
          <View
            key={entry.id}
            style={{
              flex: fillWidth ? 1 : undefined,
              width: fillWidth ? undefined : minBarWidth + 10,
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text
              style={[
                typography.small,
                {
                  color: colors.secondaryText,
                  fontVariant: ["tabular-nums"],
                },
              ]}
            >
              {entry.value}
            </Text>
            <View
              style={{
                width: fillWidth ? Math.min(minBarWidth, 18) : minBarWidth,
                height: barHeight,
                borderRadius: radius.pill,
                backgroundColor: entry.highlight ? colors.text : colors.tertiaryText,
              }}
            />
            <Text style={[typography.small, { color: colors.text, textAlign: "center" }]} numberOfLines={2}>
              {entry.label}
            </Text>
            {shouldShowSecondary && entry.secondaryLabel ? (
              <Text style={[typography.small, { color: colors.secondaryText, marginTop: -4 }]} numberOfLines={1}>
                {entry.secondaryLabel}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing.sm }}>
        {content}
      </ScrollView>
    );
  }

  return content;
}
