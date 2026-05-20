import React, { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import { formatColorSelectionLabel, groupLeafColorOptions, resolveColorDetails } from "../utils/wardrobeColors";
import Chip from "./Chip";
import ColorDot from "./ColorDot";

export default function CollapsibleColorSelector({
  title = "Цвет",
  colorOptions = [],
  selectedColorIds = [],
  selectedColorDetails = [],
  emptyLabel = "Не выбрано",
  optionDotSize = 30,
  summaryDotSize = 36,
  summaryMode = "combined",
  onToggleColor,
  onClear,
}) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const groups = useMemo(() => groupLeafColorOptions(colorOptions), [colorOptions]);
  const resolvedDetails = useMemo(
    () => resolveColorDetails(selectedColorIds, colorOptions, selectedColorDetails),
    [colorOptions, selectedColorDetails, selectedColorIds]
  );
  const summaryLabel = formatColorSelectionLabel(resolvedDetails, emptyLabel);
  const summarySwatchColors =
    summaryMode === "first" && resolvedDetails.length > 1 ? [resolvedDetails[0]] : resolvedDetails;

  if (!groups.length) {
    return null;
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        backgroundColor: colors.secondaryBackground,
        overflow: "hidden",
      }}
    >
      <Pressable onPress={() => setExpanded((current) => !current)} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Text style={[typography.meta, { color: colors.secondaryText }]}>{title}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs }}>
              {resolvedDetails.length ? <ColorDot colors={summarySwatchColors} size={summaryDotSize} /> : null}
              <Text
                numberOfLines={2}
                style={[
                  typography.body,
                  {
                    color: resolvedDetails.length ? colors.text : colors.secondaryText,
                    flex: 1,
                  },
                ]}
              >
                {summaryLabel}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
            size={20}
            color={colors.secondaryText}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: spacing.md,
            gap: spacing.md,
          }}
        >
          {resolvedDetails.length && onClear ? (
            <Pressable onPress={onClear} style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1, alignSelf: "flex-start" }]}>
              <Text style={[typography.caption, { color: colors.secondaryText }]}>Очистить</Text>
            </Pressable>
          ) : null}

          {groups.map((group) => (
            <View key={group.title}>
              <Text style={[typography.caption, { color: colors.secondaryText, marginBottom: spacing.xs }]}>{group.title}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {group.options.map((option) => (
                  <Chip
                    key={option.id}
                    label={option.name}
                    selected={(selectedColorIds ?? []).includes(option.id)}
                    onPress={() => onToggleColor?.(option.id)}
                    leftSlot={<ColorDot colors={[option]} size={optionDotSize} />}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
