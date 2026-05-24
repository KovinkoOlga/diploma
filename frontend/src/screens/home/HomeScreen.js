import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import AppHeader from "../../components/AppHeader";
import CalendarItemsGrid from "../../components/CalendarItemsGrid";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import OutfitCard from "../../components/OutfitCard";
import BasePrimaryButton from "../../components/PrimaryButton";
import Screen from "../../components/Screen";
import SectionHeader from "../../components/SectionHeader";
import { assignOutfitToDay, deleteOutfitFromDay, fetchCalendarDay, fetchCalendarEntries } from "../../api/calendar";
import { fetchCurrentWeather } from "../../api/weather";
import { Routes } from "../../navigation/routes";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAppTheme } from "../../theme/ThemeProvider";
import { buildWeekDays, calendarEntryMap, getSeasonalOutfits, pickRandomOutfitForSeason } from "../../utils/calendar";
import { formatLongRuDate, toISODate } from "../../utils/formatDate";
import WeekCalendarStrip from "./components/WeekCalendarStrip";

function PrimaryButton(props) {
  return <BasePrimaryButton scale={0.8} {...props} />;
}

function weatherSnapshot(weather) {
  if (!weather) return null;
  return {
    temperature: weather.temperature ?? null,
    feels_like: weather.feels_like ?? null,
    condition_code: weather.condition_code ?? null,
    condition_text: weather.condition_text ?? "",
    precipitation_probability: weather.precipitation_probability ?? null,
    rain_expected: Boolean(weather.rain_expected),
    recommendation_text: weather.recommendation_text ?? "",
    fetched_at: weather.fetched_at ?? "",
  };
}

function buildLocationLabel(place) {
  if (!place) return "";
  const city = place.city || place.district || place.subregion || "";
  const region = place.region || "";
  if (city && region && city !== region) return `${city}, ${region}`;
  if (city) return city;
  if (region) return region;
  return "Ваше местоположение";
}

export default function HomeScreen({ navigation }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const { items, outfits, categories } = useWardrobe();
  const [todayEntry, setTodayEntry] = useState(null);
  const [weekEntries, setWeekEntries] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState("");
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [selectedWeekDate, setSelectedWeekDate] = useState(toISODate(new Date()));
  const [saving, setSaving] = useState(false);

  const categoriesById = useMemo(() => Object.fromEntries(categories.map((entry) => [entry.id, entry])), [categories]);
  const weekDays = useMemo(() => buildWeekDays(new Date()), []);
  const weekEntriesByDate = useMemo(() => calendarEntryMap(weekEntries), [weekEntries]);
  const selectedWeekEntry = weekEntriesByDate[selectedWeekDate] ?? null;
  const todayKey = toISODate(new Date());
  const todayItemOnlyItems = todayEntry?.items ?? [];
  const selectedWeekItems = selectedWeekEntry?.items ?? [];
  const todayOutfitItems = useMemo(
    () => (todayEntry?.outfit?.item_ids ?? []).map((itemId) => items.find((item) => item.id === itemId)).filter(Boolean),
    [items, todayEntry]
  );
  const selectedWeekOutfitItems = useMemo(
    () => (selectedWeekEntry?.outfit?.item_ids ?? []).map((itemId) => items.find((item) => item.id === itemId)).filter(Boolean),
    [items, selectedWeekEntry]
  );

  const refreshCalendar = useCallback(async () => {
    setCalendarLoading(true);
    setCalendarError("");
    try {
      const weekStart = weekDays[0]?.key ?? todayKey;
      const weekEnd = weekDays[6]?.key ?? todayKey;
      const [entries, today] = await Promise.all([
        fetchCalendarEntries({ dateFrom: weekStart, dateTo: weekEnd }),
        fetchCalendarDay(todayKey),
      ]);
      setWeekEntries(entries ?? []);
      setTodayEntry(today ?? null);
      setSelectedWeekDate((current) => current || todayKey);
    } catch (error) {
      setCalendarError(error.message || "Не удалось загрузить календарь");
    } finally {
      setCalendarLoading(false);
    }
  }, [todayKey, weekDays]);

  const refreshWeather = useCallback(async () => {
    setWeatherLoading(true);
    setWeatherError("");
    setLocationError("");
    setLocationLabel("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError("Нет доступа к геолокации");
        setWeather(null);
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      try {
        const places = await Location.reverseGeocodeAsync(coords);
        setLocationLabel(buildLocationLabel(places?.[0]));
      } catch {
        setLocationLabel("Ваше местоположение");
      }

      setWeather(await fetchCurrentWeather(coords));
    } catch (error) {
      setWeather(null);
      setWeatherError(error.message || "Погода временно недоступна");
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshCalendar();
      refreshWeather();
    }, [refreshCalendar, refreshWeather])
  );

  async function saveOutfitForDate(outfit, targetDate) {
    setSaving(true);
    try {
      await assignOutfitToDay({
        date: targetDate,
        outfit_id: outfit.id,
        weather_snapshot_json: targetDate === todayKey ? weatherSnapshot(weather) : null,
      });
      await refreshCalendar();
    } catch (error) {
      Alert.alert("Не удалось сохранить", error.message || "Попробуйте ещё раз");
    } finally {
      setSaving(false);
    }
  }

  async function clearDate(date) {
    setSaving(true);
    try {
      await deleteOutfitFromDay(date);
      await refreshCalendar();
    } catch (error) {
      Alert.alert("Не удалось удалить", error.message || "Попробуйте ещё раз");
    } finally {
      setSaving(false);
    }
  }

  async function handleSeasonPick() {
    const seasonalOutfits = getSeasonalOutfits(outfits, new Date());
    if (!seasonalOutfits.length) {
      Alert.alert(
        "Нет образов для текущего сезона",
        "Добавьте или отметьте сезон у образов, чтобы приложение могло подобрать вариант автоматически."
      );
      return;
    }

    const currentOutfitId = todayEntry?.outfit?.id ?? "";
    const alternatives = currentOutfitId
      ? seasonalOutfits.filter((outfit) => outfit.id !== currentOutfitId)
      : seasonalOutfits;

    if (currentOutfitId && !alternatives.length) {
      Alert.alert(
        "Других образов для текущего сезона пока нет",
        "Добавьте больше образов с этим сезоном или выберите образ вручную."
      );
      return;
    }

    const suggested = pickRandomOutfitForSeason(outfits, new Date(), {
      excludeOutfitId: currentOutfitId,
    });
    if (!suggested) {
      Alert.alert(
        "Нет образов для текущего сезона",
        "Добавьте или отметьте сезон у образов, чтобы приложение могло подобрать вариант автоматически."
      );
      return;
    }

    await saveOutfitForDate(suggested, todayKey);
  }

  function openOutfitSelect(targetDate, returnTo = "home") {
    navigation.navigate("OutfitsTab", {
      screen: Routes.OutfitSelect,
      params: {
        targetDate,
        returnTo,
      },
    });
  }

  function openItemSelect(targetDate, returnTo = "home", source = "manual_outfit") {
    navigation.navigate("WardrobeTab", {
      screen: Routes.WardrobeItemSelect,
      params: {
        targetDate,
        returnTo,
        source,
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

  return (
    <Screen
      scroll
      padded
      header={<AppHeader title="lookbook" subtitle="ежедневный центр гардероба" />}
    >
      <View style={{ gap: spacing.lg }}>
        <Card style={{ padding: spacing.lg, borderRadius: radius.xl }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md }}>
            <Text style={[typography.screenTitle, { color: colors.text }]}>Сегодня</Text>
            <Text style={[typography.body, { color: colors.secondaryText, textAlign: "right", flexShrink: 1 }]}>
              {formatLongRuDate(new Date())}
            </Text>
          </View>

          <View style={{ marginTop: spacing.md }}>
            {weatherLoading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <ActivityIndicator color={colors.text} />
                <Text style={[typography.body, { color: colors.secondaryText }]}>Загружаем погоду...</Text>
              </View>
            ) : weather ? (
              <>
                {locationLabel ? (
                  <Text style={[typography.caption, { color: colors.secondaryText, marginBottom: 6 }]}>
                    {locationLabel}
                  </Text>
                ) : null}
                <Text style={[typography.sectionTitle, { color: colors.text }]}>
                  {Math.round(weather.temperature)}° · {weather.condition_text}
                </Text>
                {weather.precipitation_probability != null ? (
                  <Text style={[typography.body, { color: colors.secondaryText, marginTop: 6 }]}>
                    Вероятность осадков {weather.precipitation_probability}%.
                  </Text>
                ) : null}
                <Text style={[typography.body, { color: colors.text, marginTop: spacing.sm }]}>
                  {weather.recommendation_text}
                </Text>
              </>
            ) : (
              <Text style={[typography.body, { color: colors.secondaryText }]}>
                {locationError || weatherError || "Погода временно недоступна"}
              </Text>
            )}
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <SectionHeader title="Образ на сегодня" />
            <View style={{ marginTop: spacing.sm }}>
              {todayEntry?.outfit ? (
                <>
                  <OutfitCard
                    outfit={{
                      id: todayEntry.outfit.id,
                      title: todayEntry.outfit.title,
                      itemIds: todayEntry.outfit.item_ids,
                      tags: todayEntry.outfit.tags,
                      season: todayEntry.outfit.season,
                      coverImage: todayEntry.outfit.coverImage,
                      coverTransparentImage: todayEntry.outfit.coverTransparentImage,
                    }}
                    items={todayOutfitItems}
                    onPress={() => openOutfitDetails(todayEntry.outfit.id)}
                  />
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
                    <PrimaryButton
                      title="Заменить образ"
                      variant="secondary"
                      onPress={() => openOutfitSelect(todayKey, "home")}
                      disabled={!outfits.length || saving}
                    />
                    <PrimaryButton
                      title="Удалить"
                      variant="secondary"
                      onPress={() => clearDate(todayKey)}
                      disabled={saving}
                    />
                    <PrimaryButton
                      title="Подобрать по сезону"
                      variant="secondary"
                      onPress={handleSeasonPick}
                      disabled={!outfits.length || saving}
                    />
                  </View>
                </>
              ) : todayItemOnlyItems.length ? (
                <>
                  <Text style={[typography.body, { color: colors.secondaryText, marginBottom: spacing.md }]}>
                    На сегодня отмечены отдельные вещи
                  </Text>
                  <CalendarItemsGrid
                    items={todayItemOnlyItems}
                    categoriesById={categoriesById}
                    spacing={spacing.sm}
                    onPressItem={(item) => openItemDetails(item.id)}
                  />
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                    <PrimaryButton
                      title="Выбрать из образов"
                      variant="secondary"
                      onPress={() => openOutfitSelect(todayKey, "home")}
                      disabled={!outfits.length || saving}
                    />
                    <PrimaryButton
                      title="Выбрать вещи"
                      variant="secondary"
                      onPress={() => openItemSelect(todayKey, "home", "manual_outfit")}
                      disabled={!items.length || saving}
                    />
                    <PrimaryButton
                      title="Удалить"
                      variant="secondary"
                      onPress={() => clearDate(todayKey)}
                      disabled={saving}
                    />
                    <PrimaryButton
                      title="Подобрать по сезону"
                      variant="secondary"
                      onPress={handleSeasonPick}
                      disabled={!outfits.length || saving}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={[typography.body, { color: colors.secondaryText }]}>
                    Образ на сегодня ещё не выбран
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
                    <PrimaryButton title="Подобрать по сезону" onPress={handleSeasonPick} disabled={!outfits.length || saving} />
                    <PrimaryButton
                      title="Выбрать из образов"
                      variant="secondary"
                      onPress={() => openOutfitSelect(todayKey, "home")}
                      disabled={!outfits.length || saving}
                    />
                    <PrimaryButton
                      title="Выбрать вещи"
                      variant="secondary"
                      onPress={() => openItemSelect(todayKey, "home", "manual_outfit")}
                      disabled={!items.length || saving}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </Card>

        <Card style={{ padding: spacing.lg, borderRadius: radius.xl }}>
          <SectionHeader
            title="Образы на этой неделе"
            actionLabel="Открыть календарь"
            onAction={() => navigation.navigate(Routes.OutfitCalendar)}
          />
          <View style={{ marginTop: spacing.md }}>
            {calendarLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : calendarError ? (
              <Text style={[typography.body, { color: colors.secondaryText }]}>{calendarError}</Text>
            ) : (
              <>
                <WeekCalendarStrip
                  entriesByDate={weekEntriesByDate}
                  selectedDate={selectedWeekDate}
                  onSelectDate={setSelectedWeekDate}
                />

                {selectedWeekEntry?.outfit ? (
                  <View style={{ marginTop: spacing.md }}>
                    <OutfitCard
                      outfit={{
                        id: selectedWeekEntry.outfit.id,
                        title: selectedWeekEntry.outfit.title,
                        itemIds: selectedWeekEntry.outfit.item_ids,
                        tags: selectedWeekEntry.outfit.tags,
                        season: selectedWeekEntry.outfit.season,
                        coverImage: selectedWeekEntry.outfit.coverImage,
                        coverTransparentImage: selectedWeekEntry.outfit.coverTransparentImage,
                      }}
                      items={selectedWeekOutfitItems}
                      onPress={() => openOutfitDetails(selectedWeekEntry.outfit.id)}
                    />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
                      <PrimaryButton
                        title="Заменить образ"
                        onPress={() => openOutfitSelect(selectedWeekDate, "home")}
                        disabled={!outfits.length || saving}
                      />
                      <PrimaryButton
                        title="Удалить"
                        variant="secondary"
                        onPress={() => clearDate(selectedWeekDate)}
                        disabled={saving}
                      />
                    </View>
                  </View>
                ) : selectedWeekItems.length ? (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={[typography.body, { color: colors.secondaryText, marginBottom: spacing.md }]}>
                      На этот день отмечены отдельные вещи
                    </Text>
                    <CalendarItemsGrid
                      items={selectedWeekItems}
                      categoriesById={categoriesById}
                      spacing={spacing.sm}
                      onPressItem={(item) => openItemDetails(item.id)}
                    />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                      <PrimaryButton
                        title="Назначить образ"
                        onPress={() => openOutfitSelect(selectedWeekDate, "home")}
                        disabled={!outfits.length || saving}
                      />
                      <PrimaryButton
                        title="Выбрать вещи"
                        variant="secondary"
                        onPress={() => openItemSelect(selectedWeekDate, "home", "weekly_checkin")}
                        disabled={!items.length || saving}
                      />
                      <PrimaryButton
                        title="Удалить"
                        variant="secondary"
                        onPress={() => clearDate(selectedWeekDate)}
                        disabled={saving}
                      />
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      marginTop: spacing.md,
                      padding: spacing.md,
                      borderRadius: radius.lg,
                      backgroundColor: colors.secondaryBackground,
                    }}
                  >
                    <Text style={[typography.cardTitle, { color: colors.text }]}>
                      На день пока ничего не запланировано
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
                      <PrimaryButton
                        title="Назначить образ"
                        onPress={() => openOutfitSelect(selectedWeekDate, "home")}
                        disabled={!outfits.length}
                      />
                      <PrimaryButton
                        title="Выбрать вещи"
                        variant="secondary"
                        onPress={() => openItemSelect(selectedWeekDate, "home", "weekly_checkin")}
                        disabled={!items.length}
                      />
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          {!outfits.length ? (
            <View style={{ marginTop: spacing.lg }}>
              <EmptyState
                icon="bookmark-outline"
                title="Нет образов"
                subtitle="Добавьте образы, чтобы планировать их в календаре"
              />
            </View>
          ) : null}

          {!items.length ? (
            <View style={{ marginTop: spacing.lg }}>
              <EmptyState
                icon="shirt-outline"
                title="Нет вещей"
                subtitle="Добавьте вещи, чтобы отмечать, что вы носили"
              />
            </View>
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}
