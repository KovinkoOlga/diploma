import { addDays, formatLongRuDate, formatShortRuDay, toISODate } from "./formatDate";

export function parseISODate(value) {
  if (!value) return new Date();
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function startOfWeek(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setHours(0, 0, 0, 0);
  current.setDate(current.getDate() + diff);
  return current;
}

export function buildWeekDays(date = new Date()) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }).map((_, index) => {
    const value = addDays(start, index);
    return {
      key: toISODate(value),
      date: value,
      label: formatShortRuDay(value),
      title: formatLongRuDate(value),
      isToday: toISODate(value) === toISODate(new Date()),
    };
  });
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function buildMonthGrid(date = new Date()) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart);
  const days = [];

  for (let offset = 0; offset < 42; offset += 1) {
    const value = addDays(gridStart, offset);
    days.push({
      key: toISODate(value),
      date: value,
      dayNumber: value.getDate(),
      inMonth: value >= monthStart && value <= monthEnd,
      isToday: toISODate(value) === toISODate(new Date()),
    });
  }

  return days;
}

export function formatMonthTitle(date = new Date()) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return `${date.getMonth() + 1}.${date.getFullYear()}`;
  }
}

export function calendarEntryMap(entries = []) {
  return Object.fromEntries(entries.map((entry) => [entry.date, entry]));
}

function normalizeSeasonLabel(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getCurrentSeasonKey(date = new Date()) {
  const month = date.getMonth();
  if (month === 11 || month === 0 || month === 1) return "winter";
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  return "autumn";
}

export function getSeasonAliases(seasonKey) {
  switch (seasonKey) {
    case "winter":
      return ["зима", "winter"];
    case "spring":
      return ["весна", "spring", "демисезон", "осень/весна", "весна/осень"];
    case "summer":
      return ["лето", "summer"];
    case "autumn":
    default:
      return ["осень", "autumn", "fall", "демисезон", "осень/весна", "весна/осень"];
  }
}

export function getSeasonalOutfits(outfits = [], date = new Date()) {
  if (!outfits.length) return [];
  const aliases = new Set(getSeasonAliases(getCurrentSeasonKey(date)).map(normalizeSeasonLabel));
  return outfits.filter((outfit) =>
    (outfit.season ?? []).some((season) => aliases.has(normalizeSeasonLabel(season)))
  );
}

export function pickRandomOutfitForSeason(outfits = [], date = new Date(), options = {}) {
  const matches = getSeasonalOutfits(outfits, date);
  if (!matches.length) return null;
  const excludedId = options.excludeOutfitId ?? "";
  const candidates = excludedId ? matches.filter((outfit) => outfit.id !== excludedId) : matches;
  const source = candidates.length ? candidates : matches;
  const index = Math.floor(Math.random() * source.length);
  return source[index] ?? null;
}
