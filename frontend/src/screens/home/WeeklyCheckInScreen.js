import React, { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Card from "../../components/Card";
import OutfitCard from "../../components/OutfitCard";
import PrimaryButton from "../../components/PrimaryButton";
import Screen from "../../components/Screen";
import { fetchCalendarEntries } from "../../api/calendar";
import { Routes } from "../../navigation/routes";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAppTheme } from "../../theme/ThemeProvider";
import { buildWeekDays, calendarEntryMap } from "../../utils/calendar";
import { toISODate } from "../../utils/formatDate";

export default function WeeklyCheckInScreen({ navigation }) {
  const { colors, spacing, radius, typography } = useAppTheme();
  const { items, outfits } = useWardrobe();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const weekDays = useMemo(() => buildWeekDays(new Date()), []);
  const entriesByDate = useMemo(() => calendarEntryMap(entries), [entries]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchCalendarEntries({
        dateFrom: weekDays[0]?.key ?? toISODate(new Date()),
        dateTo: weekDays[6]?.key ?? toISODate(new Date()),
      });
      setEntries(data ?? []);
    } catch (requestError) {
      setError(requestError.message || "Не удалось загрузить неделю");
    } finally {
      setLoading(false);
    }
  }, [weekDays]);

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
        returnTo: "weekly",
      },
    });
  }

  function openItemSelect(targetDate) {
    navigation.navigate("WardrobeTab", {
      screen: Routes.WardrobeItemSelect,
      params: {
        targetDate,
        returnTo: "weekly",
        source: "weekly_checkin",
      },
    });
  }

  return (
    <Screen padded scroll>
      {error ? (
        <Card style={{ padding: spacing.md, borderRadius: radius.xl, marginBottom: spacing.md }}>
          <Text style={[typography.body, { color: colors.secondaryText }]}>{error}</Text>
        </Card>
      ) : null}

      <View style={{ gap: spacing.md }}>
        {weekDays.map((day) => {
          const entry = entriesByDate[day.key] ?? null;
          const outfitItems = (entry?.outfit?.item_ids ?? []).map((itemId) => items.find((item) => item.id === itemId)).filter(Boolean);
          return (
            <Card key={day.key} style={{ padding: spacing.lg, borderRadius: radius.xl }}>
              <Text style={[typography.cardTitle, { color: colors.text }]}>{day.title}</Text>
              <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 6 }]}>
                {loading ? "Загрузка..." : entry?.outfit ? "Образ назначен" : "Пока ничего не отмечено"}
              </Text>

              {entry?.outfit ? (
                <View style={{ marginTop: spacing.md }}>
                  <OutfitCard
                    outfit={{
                      id: entry.outfit.id,
                      title: entry.outfit.title,
                      itemIds: entry.outfit.item_ids,
                      tags: entry.outfit.tags,
                      season: entry.outfit.season,
                      coverImage: entry.outfit.coverImage,
                      coverTransparentImage: entry.outfit.coverTransparentImage,
                    }}
                    items={outfitItems}
                    onPress={() =>
                      navigation.navigate("OutfitsTab", {
                        screen: Routes.OutfitDetails,
                        params: { outfitId: entry.outfit.id },
                      })
                    }
                  />
                </View>
              ) : null}

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
                <PrimaryButton
                  title={entry?.outfit ? "Заменить образ" : "Выбрать образ"}
                  onPress={() => openOutfitSelect(day.key)}
                  disabled={!outfits.length}
                />
                {!entry?.outfit ? (
                  <PrimaryButton
                    title="Выбрать вещи"
                    variant="secondary"
                    onPress={() => openItemSelect(day.key)}
                    disabled={!items.length}
                  />
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
