import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import CalendarItemsGrid from "../../components/CalendarItemsGrid";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import OutfitCard from "../../components/OutfitCard";
import PrimaryButton from "../../components/PrimaryButton";
import Screen from "../../components/Screen";
import { deleteOutfitFromDay, fetchCalendarEntries } from "../../api/calendar";
import { Routes } from "../../navigation/routes";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAppTheme } from "../../theme/ThemeProvider";
import { buildMonthGrid, calendarEntryMap, endOfMonth, formatMonthTitle, parseISODate, startOfMonth } from "../../utils/calendar";
import { toISODate } from "../../utils/formatDate";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function shiftMonth(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export default function OutfitCalendarScreen({ navigation, route }) {
  const { colors, spacing, radius, typography } = useAppTheme();
  const { items, outfits, categories } = useWardrobe();
  const initialDate = route.params?.selectedDate || toISODate(new Date());
  const [visibleMonth, setVisibleMonth] = useState(parseISODate(initialDate));
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const categoriesById = useMemo(() => Object.fromEntries(categories.map((entry) => [entry.id, entry])), [categories]);
  const entryMap = useMemo(() => calendarEntryMap(entries), [entries]);
  const grid = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const selectedEntry = entryMap[selectedDate] ?? null;
  const selectedOutfitItems = useMemo(
    () => (selectedEntry?.outfit?.item_ids ?? []).map((itemId) => items.find((item) => item.id === itemId)).filter(Boolean),
    [items, selectedEntry]
  );
  const selectedItems = selectedEntry?.items ?? [];

  useEffect(() => {
    if (!route.params?.selectedDate) return;
    setSelectedDate(route.params.selectedDate);
    setVisibleMonth(parseISODate(route.params.selectedDate));
  }, [route.params?.selectedDate, route.params?.refreshKey]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchCalendarEntries({
        dateFrom: toISODate(startOfMonth(visibleMonth)),
        dateTo: toISODate(endOfMonth(visibleMonth)),
      });
      setEntries(data ?? []);
    } catch (requestError) {
      setError(requestError.message || "Не удалось загрузить календарь");
    } finally {
      setLoading(false);
    }
  }, [visibleMonth]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  function openOutfitSelect(targetDate) {
    navigation.navigate("OutfitsTab", {
      screen: Routes.OutfitSelect,
      params: {
        targetDate,
        returnTo: "calendar",
      },
    });
  }

  function openItemSelect(targetDate) {
    navigation.navigate("WardrobeTab", {
      screen: Routes.WardrobeItemSelect,
      params: {
        targetDate,
        returnTo: "calendar",
        source: "weekly_checkin",
      },
    });
  }

  function openOutfitDetails(outfitId) {
    navigation.navigate("OutfitsTab", {
      screen: Routes.OutfitDetails,
      params: { outfitId },
    });
  }

  function openItemDetails(itemId) {
    navigation.navigate("WardrobeTab", {
      screen: Routes.WardrobeItemDetails,
      params: { itemId },
    });
  }

  async function onDeleteDayContent() {
    try {
      await deleteOutfitFromDay(selectedDate);
      await loadEntries();
    } catch (requestError) {
      setError(requestError.message || "Не удалось удалить отметку с даты");
    }
  }

  return (
    <Screen padded scroll>
      <View style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => setVisibleMonth((current) => shiftMonth(current, -1))}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[typography.sectionTitle, { color: colors.text, textTransform: "capitalize" }]}>
            {formatMonthTitle(visibleMonth)}
          </Text>
          <Pressable onPress={() => setVisibleMonth((current) => shiftMonth(current, 1))}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>
        </View>

        <Card style={{ padding: spacing.md, borderRadius: radius.xl }}>
          <View style={{ flexDirection: "row", marginBottom: spacing.sm }}>
            {WEEKDAY_LABELS.map((label) => (
              <Text
                key={label}
                style={[
                  typography.caption,
                  { color: colors.secondaryText, width: `${100 / 7}%`, textAlign: "center" },
                ]}
              >
                {label}
              </Text>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.text} />
          ) : error ? (
            <Text style={[typography.body, { color: colors.secondaryText }]}>{error}</Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {grid.map((day) => {
                const entry = entryMap[day.key];
                const selected = day.key === selectedDate;
                const hasContent = Boolean(entry?.hasContent || entry?.outfit || entry?.items?.length);
                return (
                  <Pressable
                    key={day.key}
                    onPress={() => setSelectedDate(day.key)}
                    style={{ width: `${100 / 7}%`, padding: 4 }}
                  >
                    <View
                      style={{
                        minHeight: 62,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: selected ? colors.text : colors.border,
                        backgroundColor: selected ? colors.secondaryBackground : colors.background,
                        padding: 6,
                        opacity: day.inMonth ? 1 : 0.45,
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={[typography.caption, { color: colors.text }]}>{day.dayNumber}</Text>
                      <View style={{ alignItems: "flex-start", minHeight: 16 }}>
                        {hasContent ? <Ionicons name="checkmark-circle" size={14} color={colors.text} /> : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>

        <Card style={{ padding: spacing.lg, borderRadius: radius.xl }}>
          <Text style={[typography.cardTitle, { color: colors.text }]}>Дата: {selectedDate}</Text>

          <View style={{ marginTop: spacing.md }}>
            {selectedEntry?.outfit ? (
              <>
                <OutfitCard
                  outfit={{
                    id: selectedEntry.outfit.id,
                    title: selectedEntry.outfit.title,
                    itemIds: selectedEntry.outfit.item_ids,
                    tags: selectedEntry.outfit.tags,
                    season: selectedEntry.outfit.season,
                    coverImage: selectedEntry.outfit.coverImage,
                    coverTransparentImage: selectedEntry.outfit.coverTransparentImage,
                  }}
                  items={selectedOutfitItems}
                  onPress={() => openOutfitDetails(selectedEntry.outfit.id)}
                />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
                  <PrimaryButton
                    title="Заменить образ"
                    onPress={() => openOutfitSelect(selectedDate)}
                    disabled={!outfits.length}
                  />
                  <PrimaryButton title="Удалить" variant="secondary" onPress={onDeleteDayContent} />
                </View>
              </>
            ) : selectedItems.length ? (
              <>
                <Text style={[typography.body, { color: colors.secondaryText, marginBottom: spacing.md }]}>
                  На эту дату отмечены отдельные вещи
                </Text>
                <CalendarItemsGrid
                  items={selectedItems}
                  categoriesById={categoriesById}
                  spacing={spacing.sm}
                  onPressItem={(item) => openItemDetails(item.id)}
                />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  <PrimaryButton
                    title="Назначить образ"
                    onPress={() => openOutfitSelect(selectedDate)}
                    disabled={!outfits.length}
                  />
                  <PrimaryButton
                    title="Выбрать вещи"
                    variant="secondary"
                    onPress={() => openItemSelect(selectedDate)}
                    disabled={!items.length}
                  />
                  <PrimaryButton title="Удалить" variant="secondary" onPress={onDeleteDayContent} />
                </View>
              </>
            ) : (
              <>
                <EmptyState
                  icon="calendar-outline"
                  title="На день пока ничего не запланировано"
                  subtitle="Выберите образ или отметьте вещи для выбранной даты."
                />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
                  <PrimaryButton
                    title="Назначить образ"
                    onPress={() => openOutfitSelect(selectedDate)}
                    disabled={!outfits.length}
                  />
                  <PrimaryButton
                    title="Выбрать вещи"
                    variant="secondary"
                    onPress={() => openItemSelect(selectedDate)}
                    disabled={!items.length}
                  />
                </View>
              </>
            )}
          </View>
        </Card>
      </View>
    </Screen>
  );
}
