import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Card from "../../../components/Card";
import ActionButton from "../../../components/ActionButton";
import SheetModal from "../../../components/SheetModal";
import { useAppTheme } from "../../../theme/ThemeProvider";

function buildSeasonSummary(options = [], selectedIds = []) {
  if (!selectedIds.length || selectedIds.length === options.length) {
    return "Все сезоны";
  }
  return options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.label)
    .join(", ");
}

function buildYearSummary(options = [], selectedIds = []) {
  if (selectedIds.includes("all-period")) {
    return "За весь период";
  }
  if (!selectedIds.length) {
    return options[1]?.label ?? "Выбрать";
  }
  return options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.label)
    .join(", ");
}

function DropdownField({ title, value, onPress }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const subtleBorderColor = colors.text === "#111111" ? "rgba(17,17,17,0.12)" : "rgba(255,255,255,0.22)";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.82 : 1 }]}>
      <View
        style={{
          minHeight: 62,
          borderWidth: 1,
          borderColor: subtleBorderColor,
          borderRadius: radius.lg,
          backgroundColor: colors.secondaryBackground,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <Text style={[typography.meta, { color: colors.secondaryText }]}>{title}</Text>
          <Text style={[typography.body, { color: colors.text, marginTop: 4 }]} numberOfLines={1}>
            {value}
          </Text>
        </View>
        <Ionicons name="chevron-down-outline" size={18} color={colors.secondaryText} />
      </View>
    </Pressable>
  );
}

function SelectorSheet({ visible, onClose, title, options, selectedIds, onToggle }) {
  const { colors, typography, spacing, radius } = useAppTheme();

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title={title}
      footer={<ActionButton label="Готово" onPress={onClose} fullWidth />}
    >
      <View style={{ gap: spacing.sm }}>
        {options.map((option) => {
          const selected = selectedIds.includes(option.id);

          return (
            <Pressable key={option.id} onPress={() => onToggle(option.id)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
              <View
                style={{
                  minHeight: 52,
                  borderWidth: 1,
                  borderColor: selected ? colors.text : colors.border,
                  borderRadius: radius.lg,
                  backgroundColor: selected ? colors.accentSoft : colors.background,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={[typography.body, { color: colors.text, flex: 1, paddingRight: spacing.sm }]}>
                  {option.label}
                </Text>
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={selected ? colors.text : colors.secondaryText}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </SheetModal>
  );
}

export default function AccountStatsSelectors({
  seasonOptions = [],
  yearOptions = [],
  selection,
  onToggleSeason,
  onToggleYear,
}) {
  const { spacing, colors } = useAppTheme();
  const subtleBorderColor = colors.text === "#111111" ? "rgba(17,17,17,0.12)" : "rgba(255,255,255,0.22)";
  const [openSheet, setOpenSheet] = useState("");

  const seasonSummary = useMemo(
    () => buildSeasonSummary(seasonOptions, selection.seasonIds),
    [seasonOptions, selection.seasonIds]
  );
  const yearSummary = useMemo(
    () => buildYearSummary(yearOptions, selection.yearIds),
    [selection.yearIds, yearOptions]
  );

  return (
    <>
      <Card style={{ padding: spacing.md, borderWidth: 1, borderColor: subtleBorderColor }}>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <DropdownField title="Сезон" value={seasonSummary} onPress={() => setOpenSheet("season")} />
          <DropdownField title="Год" value={yearSummary} onPress={() => setOpenSheet("year")} />
        </View>
      </Card>

      <SelectorSheet
        visible={openSheet === "season"}
        onClose={() => setOpenSheet("")}
        title="Сезон"
        options={seasonOptions}
        selectedIds={selection.seasonIds}
        onToggle={onToggleSeason}
      />

      <SelectorSheet
        visible={openSheet === "year"}
        onClose={() => setOpenSheet("")}
        title="Год"
        options={yearOptions}
        selectedIds={selection.yearIds}
        onToggle={onToggleYear}
      />
    </>
  );
}
