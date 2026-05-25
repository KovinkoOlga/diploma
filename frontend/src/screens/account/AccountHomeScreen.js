import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../../components/Screen";
import AppHeader from "../../components/AppHeader";
import ActionButton from "../../components/ActionButton";
import Card from "../../components/Card";
import Avatar from "../../components/Avatar";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAuth } from "../../store/AuthStore";
import { Routes } from "../../navigation/routes";
import { fetchCalendarEntries } from "../../api/calendar";
import { fetchWearLogs } from "../../api/wearLogs";
import {
  ALL_PERIOD_ID,
  buildSeasonOptions,
  buildSelectedDateRanges,
  buildStatsSelectionLabel,
  buildYearOptions,
  calculateDataQuality,
  calculateMarkedDaysHistogram,
  calculateProfileIndicators,
  calculateTopItems,
  calculateTopOutfits,
  calculateUnusedByCategory,
  calculateUnusedItems,
  calculateWardrobeUsage,
  filterItemsForStats,
  filterOutfitsForStats,
  getAvailableDateBounds,
  getDefaultStatsSelection,
  isAllPeriodYearSelected,
} from "../../utils/accountStats";
import { toISODate } from "../../utils/formatDate";
import AccountStatsSelectors from "./components/AccountStatsSelectors";
import WardrobeUsageCard from "./components/WardrobeUsageCard";
import TopWearCard from "./components/TopWearCard";
import UnusedItemsCard from "./components/UnusedItemsCard";
import DataQualityCard from "./components/DataQualityCard";

function sameSelection(left, right) {
  return (
    left.seasonIds.length === right.seasonIds.length &&
    left.yearIds.length === right.yearIds.length &&
    left.seasonIds.every((value, index) => value === right.seasonIds[index]) &&
    left.yearIds.every((value, index) => value === right.yearIds[index])
  );
}

function IndicatorCard({ items = [] }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const subtleBorderColor = colors.text === "#111111" ? "rgba(17,17,17,0.12)" : "rgba(255,255,255,0.22)";

  return (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      {items.map((item) => (
        <Card
            key={item.label}
            style={{
              flex: 1,
              alignItems: "center",
              paddingHorizontal: spacing.xs,
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: subtleBorderColor,
            }}
          >
            <Text
              style={[
                typography.h3,
                {
                  color: colors.text,
                  fontVariant: ["tabular-nums"],
                  fontWeight: "800",
                },
              ]}
            >
              {item.value}
            </Text>
            <Text
              style={[
                typography.meta,
                {
                  color: colors.secondaryText,
                  marginTop: 6,
                  textAlign: "center",
                  fontWeight: "700",
                },
              ]}
            >
              {item.label}
            </Text>
          </Card>
      ))}
    </View>
  );
}

export default function AccountHomeScreen({ navigation }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const accountCardBorderStyle = useMemo(
    () => ({
      borderWidth: 1,
      borderColor: colors.text === "#111111" ? "rgba(17,17,17,0.12)" : "rgba(255,255,255,0.22)",
    }),
    [colors.text]
  );
  const { items, outfits, seasonOptions, categories } = useWardrobe();
  const { currentUser } = useAuth();
  const [wearHistory, setWearHistory] = useState({ outfit_logs: [], item_logs: [] });
  const [calendarEntries, setCalendarEntries] = useState([]);
  const [wearLogsLoading, setWearLogsLoading] = useState(false);
  const [wearLogsError, setWearLogsError] = useState("");
  const todayDate = useMemo(() => new Date(), []);
  const categoriesById = useMemo(() => Object.fromEntries(categories.map((entry) => [entry.id, entry])), [categories]);
  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const seasonFilterOptions = useMemo(() => buildSeasonOptions(seasonOptions), [seasonOptions]);
  const initialBounds = useMemo(
    () => getAvailableDateBounds({ currentUser, items, outfits, now: todayDate }),
    [currentUser, items, outfits, todayDate]
  );
  const yearOptions = useMemo(
    () => buildYearOptions({ currentUser, items, outfits, wearHistory, now: todayDate }),
    [currentUser, items, outfits, wearHistory, todayDate]
  );
  const defaultSelection = useMemo(() => getDefaultStatsSelection({ yearOptions, now: todayDate }), [todayDate, yearOptions]);
  const [selection, setSelection] = useState(defaultSelection);

  useEffect(() => {
    setSelection((currentSelection) => {
      const validSeasonIds = new Set(seasonFilterOptions.map((option) => option.id));
      const validYearIds = new Set(yearOptions.map((option) => option.id));
      const seasonIds = currentSelection.seasonIds.filter((value) => validSeasonIds.has(value));
      const yearIds = currentSelection.yearIds.filter((value) => validYearIds.has(value));
      const nextSelection = {
        seasonIds: seasonIds.length ? seasonIds : defaultSelection.seasonIds,
        yearIds: yearIds.length ? yearIds : defaultSelection.yearIds,
      };

      return sameSelection(currentSelection, nextSelection) ? currentSelection : nextSelection;
    });
  }, [defaultSelection, seasonFilterOptions, yearOptions]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadWearHistory() {
        if (!currentUser?.id) return;
        if (active) {
          setWearLogsLoading(true);
          setWearLogsError("");
        }

        try {
          const [response, entries] = await Promise.all([
            fetchWearLogs({
              dateFrom: toISODate(initialBounds.start),
              dateTo: toISODate(initialBounds.end),
            }),
            fetchCalendarEntries({
              dateFrom: toISODate(initialBounds.start),
              dateTo: toISODate(initialBounds.end),
            }),
          ]);
          if (active) {
            setWearHistory(response ?? { outfit_logs: [], item_logs: [] });
            setCalendarEntries(entries ?? []);
          }
        } catch (error) {
          if (active) {
            setWearHistory({ outfit_logs: [], item_logs: [] });
            setCalendarEntries([]);
            setWearLogsError(error.message || "Не удалось загрузить историю носки");
          }
        } finally {
          if (active) {
            setWearLogsLoading(false);
          }
        }
      }

      loadWearHistory();
      return () => {
        active = false;
      };
    }, [currentUser?.id, initialBounds.end, initialBounds.start])
  );

  const availableBounds = useMemo(
    () => getAvailableDateBounds({ currentUser, items, outfits, wearHistory, now: todayDate }),
    [currentUser, items, outfits, wearHistory, todayDate]
  );
  const dateRanges = useMemo(
    () =>
      buildSelectedDateRanges({
        seasonIds: selection.seasonIds,
        yearIds: selection.yearIds,
        availableBounds,
      }),
    [availableBounds, selection.seasonIds, selection.yearIds]
  );
  const allPeriodSelected = isAllPeriodYearSelected(selection.yearIds);
  const periodLabel = useMemo(
    () => buildStatsSelectionLabel({ seasonIds: selection.seasonIds, yearIds: selection.yearIds }),
    [selection.seasonIds, selection.yearIds]
  );

  const filteredItems = useMemo(
    () =>
      filterItemsForStats({
        items,
        categoriesById,
        selectedSeasonIds: selection.seasonIds,
        dateRanges,
      }),
    [categoriesById, dateRanges, items, selection.seasonIds]
  );
  const filteredOutfits = useMemo(
    () =>
      filterOutfitsForStats({
        outfits,
        selectedSeasonIds: selection.seasonIds,
        dateRanges,
      }),
    [dateRanges, outfits, selection.seasonIds]
  );

  const profileIndicators = useMemo(
    () =>
      calculateProfileIndicators({
        filteredItems,
        filteredOutfits,
      }),
    [filteredItems, filteredOutfits]
  );
  const wardrobeUsage = useMemo(
    () =>
      calculateWardrobeUsage({
        filteredItems,
        filteredOutfits,
        itemLogs: wearHistory.item_logs ?? [],
        outfitLogs: wearHistory.outfit_logs ?? [],
        calendarEntries,
        dateRanges,
      }),
    [calendarEntries, dateRanges, filteredItems, filteredOutfits, wearHistory.item_logs, wearHistory.outfit_logs]
  );
  const markedDaysHistogram = useMemo(
    () =>
      calculateMarkedDaysHistogram({
        filteredItems,
        filteredOutfits,
        itemLogs: wearHistory.item_logs ?? [],
        outfitLogs: wearHistory.outfit_logs ?? [],
        calendarEntries,
        dateRanges,
        seasonIds: selection.seasonIds,
        yearIds: selection.yearIds,
        now: todayDate,
      }),
    [calendarEntries, dateRanges, filteredItems, filteredOutfits, selection.seasonIds, selection.yearIds, todayDate, wearHistory.item_logs, wearHistory.outfit_logs]
  );
  const topItems = useMemo(
    () =>
      calculateTopItems({
        filteredItems,
        itemLogs: wearHistory.item_logs ?? [],
        dateRanges,
      }),
    [dateRanges, filteredItems, wearHistory.item_logs]
  );
  const topOutfits = useMemo(
    () =>
      calculateTopOutfits({
        filteredOutfits,
        outfitLogs: wearHistory.outfit_logs ?? [],
        dateRanges,
      }),
    [dateRanges, filteredOutfits, wearHistory.outfit_logs]
  );
  const unusedItems = useMemo(
    () =>
      calculateUnusedItems({
        filteredItems,
        itemLogs: wearHistory.item_logs ?? [],
        dateRanges,
      }),
    [dateRanges, filteredItems, wearHistory.item_logs]
  );
  const unusedCategoryHistogram = useMemo(
    () =>
      calculateUnusedByCategory({
        unusedItems,
        categoriesById,
        categories,
      }),
    [categories, categoriesById, unusedItems]
  );
  const dataQuality = useMemo(
    () =>
      calculateDataQuality({
        filteredItems,
        filteredOutfits,
        allPeriodSelected,
      }),
    [allPeriodSelected, filteredItems, filteredOutfits]
  );

  const displayName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "Профиль";
  const stats = useMemo(
    () => [
      { label: "вещи", value: profileIndicators.itemsCount },
      { label: "задействовано в образах", value: profileIndicators.engagedItemsCount },
      { label: "образы", value: profileIndicators.outfitsCount },
    ],
    [profileIndicators]
  );

  const itemSubtitleById = useMemo(
    () =>
      Object.fromEntries(
        items.map((item) => {
          const categoryTitle = categoriesById[item.categoryId]?.title;
          return [item.id, [categoryTitle, item.subcategory].filter(Boolean).join(" · ") || "Вещь"];
        })
      ),
    [categoriesById, items]
  );
  const outfitSubtitleById = useMemo(
    () =>
      Object.fromEntries(
        outfits.map((outfit) => [
          outfit.id,
          (outfit.season ?? []).join(", ") || `${(outfit.itemIds ?? []).length} вещей`,
        ])
      ),
    [outfits]
  );
  const outfitImageById = useMemo(
    () =>
      Object.fromEntries(
        outfits.map((outfit) => [
          outfit.id,
          outfit.coverTransparentImage ?? outfit.coverImage ?? itemById[outfit.itemIds?.[0]]?.image,
        ])
      ),
    [itemById, outfits]
  );

  const toggleSeason = useCallback((seasonId) => {
    setSelection((currentSelection) => {
      const exists = currentSelection.seasonIds.includes(seasonId);
      const nextSeasonIds = exists
        ? currentSelection.seasonIds.filter((value) => value !== seasonId)
        : [...currentSelection.seasonIds, seasonId];
      return {
        ...currentSelection,
        seasonIds: nextSeasonIds.length ? nextSeasonIds : currentSelection.seasonIds,
      };
    });
  }, []);

  const toggleYear = useCallback((yearId) => {
    setSelection((currentSelection) => {
      if (yearId === ALL_PERIOD_ID) {
        return { ...currentSelection, yearIds: [ALL_PERIOD_ID] };
      }

      if (currentSelection.yearIds.includes(ALL_PERIOD_ID)) {
        return { ...currentSelection, yearIds: [yearId] };
      }

      const exists = currentSelection.yearIds.includes(yearId);
      const nextYearIds = exists
        ? currentSelection.yearIds.filter((value) => value !== yearId)
        : [...currentSelection.yearIds, yearId];

      return {
        ...currentSelection,
        yearIds: nextYearIds.length ? nextYearIds : currentSelection.yearIds,
      };
    });
  }, []);

  const openItem = useCallback(
    (itemId) =>
      navigation.navigate("WardrobeTab", {
        screen: Routes.WardrobeItemDetails,
        params: { itemId },
      }),
    [navigation]
  );
  const openOutfit = useCallback(
    (outfitId) =>
      navigation.navigate("OutfitsTab", {
        screen: Routes.OutfitDetails,
        params: { outfitId },
      }),
    [navigation]
  );
  const openUnusedGrid = useCallback(
    () =>
      navigation.navigate("WardrobeTab", {
        screen: Routes.WardrobeUnusedItems,
        params: {
          itemIds: unusedItems.map((item) => item.id),
          allPeriodSelected,
        },
      }),
    [allPeriodSelected, navigation, unusedItems]
  );
  const openQualityItems = useCallback(
    () =>
      navigation.navigate("WardrobeTab", {
        screen: Routes.WardrobeDataQualityItems,
        params: {
          itemIds: dataQuality.problemItemIds ?? [],
          periodLabel,
          allPeriodSelected,
        },
      }),
    [allPeriodSelected, dataQuality.problemItemIds, navigation, periodLabel]
  );
  const openQualityOutfits = useCallback(
    () =>
      navigation.navigate("OutfitsTab", {
        screen: Routes.OutfitsDataQuality,
        params: {
          outfitIds: dataQuality.problemOutfitIds ?? [],
          periodLabel,
          allPeriodSelected,
        },
      }),
    [allPeriodSelected, dataQuality.problemOutfitIds, navigation, periodLabel]
  );

  return (
    <Screen
      scroll
      padded
      header={
        <AppHeader
          left={<Avatar size={40} label={displayName} source={currentUser?.avatarUrl ? { uri: currentUser.avatarUrl } : undefined} />}
          title={displayName}
          right={<ActionButton icon="settings-outline" compact variant="ghost" onPress={() => navigation.navigate(Routes.Settings)} />}
        />
      }
    >
      <View style={{ gap: spacing.lg }}>
        <AccountStatsSelectors
          seasonOptions={seasonFilterOptions}
          yearOptions={yearOptions}
          selection={selection}
          onToggleSeason={toggleSeason}
          onToggleYear={toggleYear}
        />

        <IndicatorCard items={stats} />

        {wearLogsError ? (
          <Card style={{ padding: spacing.md, borderRadius: radius.lg, ...accountCardBorderStyle }}>
            <Text style={[typography.cardTitle, { color: colors.text }]}>Статистика временно неполная</Text>
            <Text style={[typography.body, { color: colors.secondaryText, marginTop: 6 }]}>{wearLogsError}</Text>
          </Card>
        ) : null}

        {wearLogsLoading ? (
          <Card style={{ padding: spacing.md, ...accountCardBorderStyle }}>
            <Text style={[typography.body, { color: colors.secondaryText }]}>Загружаем историю носки и календаря…</Text>
          </Card>
        ) : null}

        <WardrobeUsageCard periodLabel={periodLabel} usage={wardrobeUsage} histogramData={markedDaysHistogram} borderStyle={accountCardBorderStyle} />

        <TopWearCard
          topItems={topItems}
          topOutfits={topOutfits}
          itemSubtitleById={itemSubtitleById}
          outfitSubtitleById={outfitSubtitleById}
          outfitImageById={outfitImageById}
          onOpenItem={openItem}
          onOpenOutfit={openOutfit}
          borderStyle={accountCardBorderStyle}
        />

        <UnusedItemsCard
          allPeriodSelected={allPeriodSelected}
          unusedItems={unusedItems}
          previewItems={unusedItems.slice(0, 6)}
          histogramData={unusedCategoryHistogram}
          itemSubtitleById={itemSubtitleById}
          onOpenItem={openItem}
          onOpenAll={openUnusedGrid}
          borderStyle={accountCardBorderStyle}
        />

        <DataQualityCard
          quality={dataQuality}
          itemsCount={(dataQuality.problemItemIds ?? []).length}
          outfitsCount={(dataQuality.problemOutfitIds ?? []).length}
          onOpenItems={openQualityItems}
          onOpenOutfits={openQualityOutfits}
          borderStyle={accountCardBorderStyle}
        />

        <View style={{ height: spacing.xs }} />
      </View>
    </Screen>
  );
}
