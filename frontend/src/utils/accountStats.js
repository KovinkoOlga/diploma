import { getCurrentSeasonKey, parseISODate } from "./calendar";

const ALL_PERIOD_ID = "all-period";
const EXCLUDED_CATEGORY_ALIASES = new Set([
  "аксессуар",
  "аксессуары",
  "accessory",
  "accessories",
  "сумка",
  "сумки",
  "bag",
  "bags",
]);

const CANONICAL_SEASONS = [
  {
    id: "winter",
    label: "Зима",
    aliases: ["зима", "winter"],
    months: [0, 1, 11],
    endMonthIndex: 11,
  },
  {
    id: "spring",
    label: "Весна",
    aliases: ["весна", "spring", "демисезон", "деми сезон", "осень/весна", "весна/осень", "spring/autumn"],
    months: [2, 3, 4],
    endMonthIndex: 4,
  },
  {
    id: "summer",
    label: "Лето",
    aliases: ["лето", "summer"],
    months: [5, 6, 7],
    endMonthIndex: 7,
  },
  {
    id: "autumn",
    label: "Осень",
    aliases: ["осень", "autumn", "fall", "демисезон", "деми сезон", "осень/весна", "весна/осень", "spring/autumn"],
    months: [8, 9, 10],
    endMonthIndex: 10,
  },
];

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function parseDate(value) {
  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = parseISODate(value);
    return isValidDate(date) ? date : null;
  }
  const date = new Date(value);
  return isValidDate(date) ? date : null;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function endOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0);
}

function toDateTimestamp(value) {
  return startOfDay(value).getTime();
}

function compareRanges(left, right) {
  return toDateTimestamp(left.start) - toDateTimestamp(right.start);
}

function sortNumericYearIds(ids = []) {
  return ids
    .filter((entry) => /^\d{4}$/.test(String(entry)))
    .map((entry) => String(entry))
    .sort((left, right) => Number(left) - Number(right));
}

function getSeasonConfigById(id) {
  return CANONICAL_SEASONS.find((season) => season.id === id) ?? null;
}

function hasSpecificSeasonFilter(selectedSeasonIds = []) {
  const uniqueIds = Array.from(new Set(selectedSeasonIds.filter(Boolean)));
  return uniqueIds.length > 0 && uniqueIds.length < CANONICAL_SEASONS.length;
}

function isAllPeriodYearSelected(selectedYearIds = []) {
  return selectedYearIds.includes(ALL_PERIOD_ID);
}

function categoryTitleForItem(item, categoriesById = {}) {
  return categoriesById[item?.categoryId]?.title ?? categoriesById[item?.categoryId]?.name ?? item?.category ?? item?.categoryTitle ?? "";
}

function isExcludedCategoryName(value) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (EXCLUDED_CATEGORY_ALIASES.has(normalized)) return true;
  return (
    normalized.includes("сумк") ||
    normalized.includes("bag") ||
    normalized.includes("аксессуар") ||
    normalized.includes("accessor")
  );
}

function isExcludedCategoryItem(item, categoriesById = {}) {
  const category = categoriesById[item?.categoryId];
  return (
    isExcludedCategoryName(category?.title) ||
    isExcludedCategoryName(category?.name) ||
    isExcludedCategoryName(category?.id) ||
    isExcludedCategoryName(item?.category) ||
    isExcludedCategoryName(item?.categoryTitle) ||
    isExcludedCategoryName(item?.categoryName) ||
    isExcludedCategoryName(item?.subcategory)
  );
}

function getMaxRangeEnd(dateRanges = []) {
  return dateRanges.reduce((max, range) => {
    const end = parseDate(range?.end);
    if (!end) return max;
    return !max || end > max ? end : max;
  }, null);
}

function isCreatedWithinRanges(entity, dateRanges = []) {
  const createdAt = parseDate(entity?.createdAt ?? entity?.created_at);
  if (!createdAt) return true;
  const maxEnd = getMaxRangeEnd(dateRanges);
  if (!maxEnd) return true;
  return startOfDay(createdAt) <= endOfDay(maxEnd);
}

function seasonMatchesCanonical(value, canonicalSeasonId) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return false;
  const config = getSeasonConfigById(canonicalSeasonId);
  if (!config) return false;
  return config.aliases.some((alias) => normalizeText(alias) === normalizedValue);
}

function matchesSelectedSeasons(values = [], selectedSeasonIds = []) {
  if (!hasSpecificSeasonFilter(selectedSeasonIds)) return true;
  return selectedSeasonIds.some((seasonId) => values.some((value) => seasonMatchesCanonical(value, seasonId)));
}

function uniqueById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function mergeRanges(ranges = []) {
  if (!ranges.length) return [];
  const sorted = ranges
    .map((range) => ({
      start: startOfDay(parseDate(range.start)),
      end: endOfDay(parseDate(range.end)),
    }))
    .filter((range) => range.start && range.end && range.start <= range.end)
    .sort(compareRanges);

  const merged = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];
    const nextDay = new Date(previous.end);
    nextDay.setDate(nextDay.getDate() + 1);
    if (current.start <= nextDay) {
      if (current.end > previous.end) {
        previous.end = current.end;
      }
      continue;
    }
    merged.push(current);
  }
  return merged;
}

function clampRange(range, bounds) {
  const start = startOfDay(range.start);
  const end = endOfDay(range.end);
  const boundedStart = start < bounds.start ? bounds.start : start;
  const boundedEnd = end > bounds.end ? bounds.end : end;
  if (boundedStart > boundedEnd) return null;
  return { start: boundedStart, end: boundedEnd };
}

function createSeasonRangesForYear(year, seasonId) {
  const season = getSeasonConfigById(seasonId);
  if (!season) return [];

  if (seasonId === "winter") {
    return [
      { start: new Date(year, 0, 1), end: endOfMonth(year, 1) },
      { start: new Date(year, 11, 1), end: endOfMonth(year, 11) },
    ];
  }

  return [
    {
      start: new Date(year, season.months[0], 1),
      end: endOfMonth(year, season.months[season.months.length - 1]),
    },
  ];
}

function formatMonthShort(monthIndex) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(new Date(2026, monthIndex, 1)).replace(".", "");
  } catch {
    return String(monthIndex + 1);
  }
}

function getLogDate(log) {
  return log?.worn_date ?? log?.wornDate ?? "";
}

function getCalendarEntryDate(entry) {
  return entry?.date ?? "";
}

function isDateWithinRanges(dateValue, dateRanges = []) {
  const date = parseDate(dateValue);
  if (!date) return false;
  const timestamp = toDateTimestamp(date);
  return dateRanges.some((range) => {
    const start = toDateTimestamp(range.start);
    const end = toDateTimestamp(range.end);
    return timestamp >= start && timestamp <= end;
  });
}

function filterLogsByDateRanges(logs = [], dateRanges = []) {
  if (!dateRanges.length) return [];
  return logs.filter((log) => isDateWithinRanges(getLogDate(log), dateRanges));
}

function buildLatestWearMap(itemLogs = []) {
  return itemLogs.reduce((acc, log) => {
    const itemId = log?.item_id ?? log?.itemId;
    const wornDate = getLogDate(log);
    if (!itemId || !wornDate) return acc;
    if (!acc[itemId] || wornDate > acc[itemId]) {
      acc[itemId] = wornDate;
    }
    return acc;
  }, {});
}

function formatSeasonLabels(selectedSeasonIds = []) {
  return CANONICAL_SEASONS.filter((season) => selectedSeasonIds.includes(season.id)).map((season) => season.label);
}

function availableBoundsFromRanges(dateRanges = []) {
  if (!dateRanges.length) {
    const today = new Date();
    return { start: startOfDay(today), end: endOfDay(today) };
  }
  const sortedRanges = dateRanges.slice().sort(compareRanges);
  return {
    start: sortedRanges[0].start,
    end: sortedRanges[sortedRanges.length - 1].end,
  };
}

function getDataQualityIssues(problemCounts = {}, allPeriodSelected = false) {
  const issues = [];
  if (problemCounts.missingColor) {
    issues.push({ id: "missingColor", label: `Без цвета — ${problemCounts.missingColor} ${formatThingWord(problemCounts.missingColor)}` });
  }
  if (problemCounts.missingCategory) {
    issues.push({
      id: "missingCategory",
      label: `Без категории или подкатегории — ${problemCounts.missingCategory} ${formatThingWord(problemCounts.missingCategory)}`,
    });
  }
  if (allPeriodSelected && problemCounts.missingSeason) {
    issues.push({ id: "missingSeason", label: `Без сезона — ${problemCounts.missingSeason} ${formatThingWord(problemCounts.missingSeason)}` });
  }
  if (problemCounts.missingImage) {
    issues.push({
      id: "missingImage",
      label: `Без изображения — ${problemCounts.missingImage} ${formatThingWord(problemCounts.missingImage)}`,
    });
  }
  if (problemCounts.outfitsWithoutSeason) {
    issues.push({ id: "outfitsWithoutSeason", label: `Образы без сезона — ${problemCounts.outfitsWithoutSeason}` });
  }
  if (problemCounts.outfitsWithoutItems) {
    issues.push({ id: "outfitsWithoutItems", label: `Образы без вещей — ${problemCounts.outfitsWithoutItems}` });
  }
  return issues;
}

function calendarEntryHasRelevantContent(entry, options = {}) {
  const { allowedItemIds = null, allowedOutfitIds = null } = options;
  const outfitId = entry?.outfit?.id ?? "";
  const outfitItemIds = entry?.outfit?.itemIds ?? entry?.outfit?.item_ids ?? [];
  const entryItemIds = (entry?.items ?? []).map((item) => item?.id).filter(Boolean);

  if (allowedOutfitIds && outfitId && allowedOutfitIds.has(outfitId)) {
    return true;
  }

  if (allowedItemIds) {
    if (entryItemIds.some((itemId) => allowedItemIds.has(itemId))) return true;
    if (outfitItemIds.some((itemId) => allowedItemIds.has(itemId))) return true;
    return false;
  }

  return Boolean(outfitId || entryItemIds.length || outfitItemIds.length);
}

function getRelevantMarkedDates(itemLogs = [], outfitLogs = [], dateRanges = [], options = {}) {
  const { allowedItemIds = null, allowedOutfitIds = null } = options;
  const markedDates = new Set();

  for (const log of filterLogsByDateRanges(itemLogs, dateRanges)) {
    const itemId = log?.item_id ?? log?.itemId;
    const wornDate = getLogDate(log);
    if (!wornDate) continue;
    if (allowedItemIds && !allowedItemIds.has(itemId)) continue;
    markedDates.add(wornDate);
  }

  for (const log of filterLogsByDateRanges(outfitLogs, dateRanges)) {
    const outfitId = log?.outfit_id ?? log?.outfitId;
    const wornDate = getLogDate(log);
    if (!wornDate) continue;
    if (allowedOutfitIds && !allowedOutfitIds.has(outfitId)) continue;
    markedDates.add(wornDate);
  }

  return markedDates;
}

function getMarkedDatesFromCalendarEntries(calendarEntries = [], dateRanges = [], options = {}) {
  const markedDates = new Set();
  for (const entry of calendarEntries) {
    const entryDate = getCalendarEntryDate(entry);
    if (!entryDate || !isDateWithinRanges(entryDate, dateRanges)) continue;
    if (!calendarEntryHasRelevantContent(entry, options)) continue;
    markedDates.add(entryDate);
  }
  return markedDates;
}

function groupMarkedDatesByMonth(markedDates = new Set()) {
  return Array.from(markedDates).reduce((acc, dateValue) => {
    const date = parseDate(dateValue);
    if (!date) return acc;
    const monthKey = date.getMonth();
    acc[monthKey] = (acc[monthKey] ?? 0) + 1;
    return acc;
  }, {});
}

function groupMarkedDatesBySeason(markedDates = new Set()) {
  return Array.from(markedDates).reduce((acc, dateValue) => {
    const date = parseDate(dateValue);
    if (!date) return acc;
    const seasonId = getCurrentSeasonKey(date);
    acc[seasonId] = (acc[seasonId] ?? 0) + 1;
    return acc;
  }, {});
}

function groupMarkedDatesByYear(markedDates = new Set()) {
  return Array.from(markedDates).reduce((acc, dateValue) => {
    const date = parseDate(dateValue);
    if (!date) return acc;
    const yearKey = String(date.getFullYear());
    acc[yearKey] = (acc[yearKey] ?? 0) + 1;
    return acc;
  }, {});
}

function formatThingWord(count) {
  const value = Math.abs(Number(count) || 0);
  const lastTwo = value % 100;
  const last = value % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return "вещей";
  if (last === 1) return "вещь";
  if (last >= 2 && last <= 4) return "вещи";
  return "вещей";
}

function formatOutfitWord(count) {
  const value = Math.abs(Number(count) || 0);
  const lastTwo = value % 100;
  const last = value % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return "образов";
  if (last === 1) return "образ";
  if (last >= 2 && last <= 4) return "образа";
  return "образов";
}

export function getAvailableDateBounds({ currentUser, items = [], outfits = [], wearHistory = {}, now = new Date() } = {}) {
  const candidates = [
    currentUser?.createdAt,
    ...items.map((item) => item.createdAt ?? item.created_at),
    ...outfits.map((outfit) => outfit.createdAt ?? outfit.created_at),
    ...(wearHistory.item_logs ?? wearHistory.itemLogs ?? []).map((log) => getLogDate(log) || log.created_at || log.createdAt),
    ...(wearHistory.outfit_logs ?? wearHistory.outfitLogs ?? []).map((log) => getLogDate(log) || log.created_at || log.createdAt),
  ]
    .map(parseDate)
    .filter(Boolean)
    .sort((left, right) => left - right);

  const end = endOfDay(parseDate(now) ?? new Date());
  const start = startOfDay(candidates[0] ?? end);
  return { start, end };
}

export function buildSeasonOptions(projectSeasonOptions = []) {
  const normalizedProjectOptions = projectSeasonOptions
    .map((value) => ({ raw: value, normalized: normalizeText(value) }))
    .filter((entry) => entry.normalized);

  return CANONICAL_SEASONS.map((season) => {
    const values = normalizedProjectOptions
      .filter((entry) => season.aliases.some((alias) => normalizeText(alias) === entry.normalized))
      .map((entry) => entry.raw);

    return {
      id: season.id,
      label: season.label,
      values: values.length ? values : season.aliases.filter((alias) => /^[а-я]/i.test(alias)),
    };
  });
}

export function buildYearOptions({ currentUser, items = [], outfits = [], wearHistory = {}, now = new Date() } = {}) {
  const bounds = getAvailableDateBounds({ currentUser, items, outfits, wearHistory, now });
  const startYear = bounds.start.getFullYear();
  const endYear = bounds.end.getFullYear();
  const years = [];

  for (let year = endYear; year >= startYear; year -= 1) {
    years.push({ id: String(year), label: String(year) });
  }

  return [{ id: ALL_PERIOD_ID, label: "За весь период", isAllPeriod: true }, ...years];
}

export function getDefaultStatsSelection({ yearOptions = [], now = new Date() } = {}) {
  const currentSeasonId = getCurrentSeasonKey(now);
  const currentYearId = String((parseDate(now) ?? new Date()).getFullYear());
  const fallbackYearId = yearOptions.find((option) => option.id === currentYearId)?.id ?? yearOptions[1]?.id ?? currentYearId;

  return {
    seasonIds: [currentSeasonId],
    yearIds: [fallbackYearId],
  };
}

export function buildSelectedDateRanges({
  seasonIds = [],
  yearIds = [],
  availableBounds,
  currentUser,
  items = [],
  outfits = [],
  wearHistory = {},
  now = new Date(),
} = {}) {
  const bounds = availableBounds ?? getAvailableDateBounds({ currentUser, items, outfits, wearHistory, now });
  const selectedYearIds = yearIds.length ? yearIds : [String(bounds.end.getFullYear())];
  const selectedSeasonIds = Array.from(new Set(seasonIds.filter(Boolean)));
  const allPeriodSelected = isAllPeriodYearSelected(selectedYearIds);
  const specificSeasonSelection = hasSpecificSeasonFilter(selectedSeasonIds);

  if (allPeriodSelected && !specificSeasonSelection) {
    return [{ start: bounds.start, end: bounds.end }];
  }

  const targetYears = allPeriodSelected
    ? Array.from({ length: bounds.end.getFullYear() - bounds.start.getFullYear() + 1 }, (_, index) => bounds.start.getFullYear() + index)
    : sortNumericYearIds(selectedYearIds).map(Number);

  const seasonTargets = specificSeasonSelection ? selectedSeasonIds : CANONICAL_SEASONS.map((season) => season.id);
  const baseRanges = [];

  for (const year of targetYears) {
    if (!specificSeasonSelection) {
      baseRanges.push({
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31),
      });
      continue;
    }

    for (const seasonId of seasonTargets) {
      baseRanges.push(...createSeasonRangesForYear(year, seasonId));
    }
  }

  return mergeRanges(
    baseRanges
      .map((range) => clampRange(range, bounds))
      .filter(Boolean)
  );
}

export function buildStatsSelectionLabel({ seasonIds = [], yearIds = [] } = {}) {
  const seasonLabels = formatSeasonLabels(seasonIds);
  const yearLabels = sortNumericYearIds(yearIds);
  const allPeriodSelected = isAllPeriodYearSelected(yearIds);
  const showSeasonLabels = hasSpecificSeasonFilter(seasonIds);

  if (allPeriodSelected && !showSeasonLabels) {
    return "За весь период";
  }

  const seasonsTitle = showSeasonLabels ? seasonLabels.join(", ") : "";
  const yearsTitle = allPeriodSelected ? "За весь период" : yearLabels.join(", ");

  if (seasonsTitle && yearLabels.length === 1 && !allPeriodSelected) {
    return `${seasonsTitle} ${yearLabels[0]}`;
  }

  if (seasonsTitle && yearsTitle) {
    return `${seasonsTitle} · ${yearsTitle}`;
  }

  return yearsTitle || "За весь период";
}

export function filterItemsForStats({
  items = [],
  categoriesById = {},
  selectedSeasonIds = [],
  dateRanges = [],
} = {}) {
  return uniqueById(items).filter((item) => {
    if (!item || item.isArchived || item.status === "archived") return false;
    if (isExcludedCategoryItem(item, categoriesById)) return false;
    if (!isCreatedWithinRanges(item, dateRanges)) return false;
    return matchesSelectedSeasons(item.seasons ?? item.season ?? [], selectedSeasonIds);
  });
}

export function filterOutfitsForStats({
  outfits = [],
  selectedSeasonIds = [],
  dateRanges = [],
} = {}) {
  return uniqueById(outfits).filter((outfit) => {
    if (!outfit) return false;
    if (!isCreatedWithinRanges(outfit, dateRanges)) return false;
    return matchesSelectedSeasons(outfit.season ?? [], selectedSeasonIds);
  });
}

export function calculateProfileIndicators({
  filteredItems = [],
  filteredOutfits = [],
} = {}) {
  const allowedItemIds = new Set(filteredItems.map((item) => item.id));
  const engagedItemIds = new Set();

  for (const outfit of filteredOutfits) {
    for (const itemId of outfit.itemIds ?? []) {
      if (allowedItemIds.has(itemId)) {
        engagedItemIds.add(itemId);
      }
    }
  }

  return {
    itemsCount: filteredItems.length,
    engagedItemsCount: engagedItemIds.size,
    outfitsCount: filteredOutfits.length,
  };
}

export function calculateWardrobeUsage({
  filteredItems = [],
  filteredOutfits = [],
  itemLogs = [],
  outfitLogs = [],
  calendarEntries = [],
  dateRanges = [],
} = {}) {
  const allowedItemIds = new Set(filteredItems.map((item) => item.id));
  const allowedOutfitIds = new Set(filteredOutfits.map((outfit) => outfit.id));
  const selectedItemLogs = filterLogsByDateRanges(itemLogs, dateRanges).filter((log) =>
    allowedItemIds.has(log?.item_id ?? log?.itemId)
  );
  const selectedOutfitLogs = filterLogsByDateRanges(outfitLogs, dateRanges).filter((log) =>
    allowedOutfitIds.has(log?.outfit_id ?? log?.outfitId)
  );
  const usedItemIds = new Set();
  const markedDates = calendarEntries.length
    ? getMarkedDatesFromCalendarEntries(calendarEntries, dateRanges, {
        allowedItemIds,
        allowedOutfitIds,
      })
    : getRelevantMarkedDates(itemLogs, outfitLogs, dateRanges, {
        allowedItemIds,
        allowedOutfitIds,
      });

  for (const log of selectedItemLogs) {
    const itemId = log?.item_id ?? log?.itemId;
    if (allowedItemIds.has(itemId)) {
      usedItemIds.add(itemId);
    }
  }

  const activeCount = filteredItems.length;
  const usedCount = usedItemIds.size;
  const usagePercent = activeCount ? Math.round((usedCount / activeCount) * 100) : 0;

  return {
    activeCount,
    usedCount,
    usagePercent,
    markedDaysCount: markedDates.size,
    selectedItemLogs,
    selectedOutfitLogs,
  };
}

export function calculateMarkedDaysHistogram({
  filteredItems = [],
  filteredOutfits = [],
  itemLogs = [],
  outfitLogs = [],
  calendarEntries = [],
  dateRanges = [],
  seasonIds = [],
  yearIds = [],
  now = new Date(),
} = {}) {
  if (!dateRanges.length) return [];

  const allowedItemIds = new Set(filteredItems.map((item) => item.id));
  const allowedOutfitIds = new Set(filteredOutfits.map((outfit) => outfit.id));
  const markedDates = calendarEntries.length
    ? getMarkedDatesFromCalendarEntries(calendarEntries, dateRanges, {
        allowedItemIds,
        allowedOutfitIds,
      })
    : getRelevantMarkedDates(itemLogs, outfitLogs, dateRanges, {
        allowedItemIds,
        allowedOutfitIds,
      });
  const today = parseDate(now) ?? new Date();
  const specificSeasonSelection = hasSpecificSeasonFilter(seasonIds);
  const numericYearIds = sortNumericYearIds(yearIds);
  const allPeriodSelected = isAllPeriodYearSelected(yearIds);

  if (specificSeasonSelection) {
    const countsByMonth = groupMarkedDatesByMonth(markedDates);
    const monthIndexes = Array.from(new Set(seasonIds.flatMap((seasonId) => getSeasonConfigById(seasonId)?.months ?? []))).sort(
      (left, right) => left - right
    );
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const selectedYears = allPeriodSelected
      ? Array.from({ length: availableBoundsFromRanges(dateRanges).end.getFullYear() - availableBoundsFromRanges(dateRanges).start.getFullYear() + 1 }, (_, index) => availableBoundsFromRanges(dateRanges).start.getFullYear() + index)
      : numericYearIds.map(Number);

    return monthIndexes.map((monthIndex) => ({
      id: `month-${monthIndex}`,
      label: formatMonthShort(monthIndex),
      value: countsByMonth[monthIndex] ?? 0,
      highlight: selectedYears.some((year) => new Date(year, monthIndex, 1) <= currentMonthStart),
    }));
  }

  if (!allPeriodSelected && numericYearIds.length === 1) {
    const targetYear = Number(numericYearIds[0]);
    const countsBySeason = groupMarkedDatesBySeason(markedDates);

    return CANONICAL_SEASONS.map((season) => ({
      id: season.id,
      label: season.label,
      value: countsBySeason[season.id] ?? 0,
      highlight: new Date(targetYear, season.months[0], 1) <= endOfDay(today),
    }));
  }

  const countsByYear = groupMarkedDatesByYear(markedDates);
  const bounds = availableBoundsFromRanges(dateRanges);
  const yearKeys = allPeriodSelected
    ? Array.from({ length: bounds.end.getFullYear() - bounds.start.getFullYear() + 1 }, (_, index) => String(bounds.start.getFullYear() + index))
    : numericYearIds;

  return yearKeys.map((yearKey) => ({
    id: `year-${yearKey}`,
    label: yearKey,
    value: countsByYear[yearKey] ?? 0,
    highlight: Number(yearKey) <= today.getFullYear(),
  }));
}

export function calculateTopItems({
  filteredItems = [],
  itemLogs = [],
  dateRanges = [],
} = {}) {
  const selectedLogs = filterLogsByDateRanges(itemLogs, dateRanges);
  const allowedItemIds = new Set(filteredItems.map((item) => item.id));
  const counts = selectedLogs.reduce((acc, log) => {
    const itemId = log?.item_id ?? log?.itemId;
    if (!allowedItemIds.has(itemId)) return acc;
    acc[itemId] = (acc[itemId] ?? 0) + 1;
    return acc;
  }, {});

  return filteredItems
    .filter((item) => counts[item.id])
    .map((item) => ({ item, wearCount: counts[item.id] }))
    .sort((left, right) => right.wearCount - left.wearCount || left.item.title.localeCompare(right.item.title, "ru"))
    .slice(0, 5);
}

export function calculateTopOutfits({
  filteredOutfits = [],
  outfitLogs = [],
  dateRanges = [],
} = {}) {
  const selectedLogs = filterLogsByDateRanges(outfitLogs, dateRanges);
  const allowedOutfitIds = new Set(filteredOutfits.map((outfit) => outfit.id));
  const counts = selectedLogs.reduce((acc, log) => {
    const outfitId = log?.outfit_id ?? log?.outfitId;
    if (!allowedOutfitIds.has(outfitId)) return acc;
    acc[outfitId] = (acc[outfitId] ?? 0) + 1;
    return acc;
  }, {});

  return filteredOutfits
    .filter((outfit) => counts[outfit.id])
    .map((outfit) => ({ outfit, wearCount: counts[outfit.id] }))
    .sort((left, right) => right.wearCount - left.wearCount || left.outfit.title.localeCompare(right.outfit.title, "ru"))
    .slice(0, 3);
}

export function calculateUnusedItems({
  filteredItems = [],
  itemLogs = [],
  dateRanges = [],
} = {}) {
  const selectedLogs = filterLogsByDateRanges(itemLogs, dateRanges);
  const latestWearMap = buildLatestWearMap(itemLogs);
  const usedItemIds = new Set(selectedLogs.map((log) => log?.item_id ?? log?.itemId).filter(Boolean));

  return filteredItems
    .filter((item) => !usedItemIds.has(item.id))
    .sort((left, right) => {
      const leftLastWear = latestWearMap[left.id] ?? "";
      const rightLastWear = latestWearMap[right.id] ?? "";
      if (!leftLastWear && rightLastWear) return -1;
      if (leftLastWear && !rightLastWear) return 1;
      if (leftLastWear !== rightLastWear) return leftLastWear.localeCompare(rightLastWear);
      return left.title.localeCompare(right.title, "ru");
    });
}

export function calculateUnusedByCategory({
  unusedItems = [],
  categoriesById = {},
  categories = [],
} = {}) {
  const counts = unusedItems.reduce((acc, item) => {
    const title = categoryTitleForItem(item, categoriesById) || "Без категории";
    acc[title] = (acc[title] ?? 0) + 1;
    return acc;
  }, {});

  return categories
    .filter((category) => !isExcludedCategoryName(category?.title) && !isExcludedCategoryName(category?.name) && !isExcludedCategoryName(category?.id))
    .map((category) => category.title ?? category.name ?? category.id)
    .filter(Boolean)
    .map((label) => ({
      id: label,
      label,
      value: counts[label] ?? 0,
      highlight: (counts[label] ?? 0) > 0,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "ru"));
}

export function calculateDataQuality({
  filteredItems = [],
  filteredOutfits = [],
  allPeriodSelected = false,
} = {}) {
  const problemCounts = {
    missingColor: 0,
    missingCategory: 0,
    missingSeason: 0,
    missingImage: 0,
    outfitsWithoutSeason: 0,
    outfitsWithoutItems: 0,
  };
  const problemItemIds = new Set();
  const problemOutfitIds = new Set();

  let totalChecks = 0;
  let missingChecks = 0;

  for (const item of filteredItems) {
    const hasColor = Boolean(item.colorDetails?.length || item.colorIds?.length);
    const hasCategory = Boolean(item.categoryId && String(item.subcategory ?? "").trim());
    const hasImage = Boolean(item.image?.uri || item.image || item.primaryImageFileId);
    const hasSeason = Boolean((item.seasons ?? item.season ?? []).length);

    totalChecks += 3;
    if (!hasColor) {
      problemCounts.missingColor += 1;
      missingChecks += 1;
      problemItemIds.add(item.id);
    }
    if (!hasCategory) {
      problemCounts.missingCategory += 1;
      missingChecks += 1;
      problemItemIds.add(item.id);
    }
    if (!hasImage) {
      problemCounts.missingImage += 1;
      missingChecks += 1;
      problemItemIds.add(item.id);
    }

    if (allPeriodSelected) {
      totalChecks += 1;
      if (!hasSeason) {
        problemCounts.missingSeason += 1;
        missingChecks += 1;
        problemItemIds.add(item.id);
      }
    }
  }

  for (const outfit of filteredOutfits) {
    const hasSeason = Boolean((outfit.season ?? []).length);
    const hasItems = Boolean((outfit.itemIds ?? []).length);

    totalChecks += 2;
    if (!hasSeason) {
      problemCounts.outfitsWithoutSeason += 1;
      missingChecks += 1;
      problemOutfitIds.add(outfit.id);
    }
    if (!hasItems) {
      problemCounts.outfitsWithoutItems += 1;
      missingChecks += 1;
      problemOutfitIds.add(outfit.id);
    }
  }

  const completenessPercent = totalChecks ? Math.round(((totalChecks - missingChecks) / totalChecks) * 100) : 100;

  return {
    completenessPercent,
    issues: getDataQualityIssues(problemCounts, allPeriodSelected),
    hasIssues: missingChecks > 0,
    problemItemIds: Array.from(problemItemIds),
    problemOutfitIds: Array.from(problemOutfitIds),
  };
}

export { ALL_PERIOD_ID, CANONICAL_SEASONS, formatOutfitWord, formatThingWord, isAllPeriodYearSelected };
