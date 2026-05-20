import { toISODate } from "./formatDate";
import { getItemColorNames, resolveColorDetails } from "./wardrobeColors";

const placeholderImage = require("../../assets/icon.png");

export const WARDROBE_STATUSES = [
  { id: "active", title: "Активна" },
  { id: "archived", title: "В архиве" },
  { id: "requires_repair", title: "Требует ремонта" },
  { id: "given_away", title: "Отдана / продана" },
];

export const WARDROBE_SEASONS = ["весна", "лето", "осень", "зима"];
export const WARDROBE_STYLES = ["casual", "office", "sport", "classic", "warm", "evening", "home"];
export const WARDROBE_MATERIALS = ["хлопок", "деним", "шерсть", "кожа", "вискоза", "эластан", "габардин"];
export const WARDROBE_SIZES = ["XS", "S", "M", "L", "XL", "38", "39", "40", "one size", "28", "29"];
export const WARDROBE_SORT_OPTIONS = [
  { id: "recent", title: "Недавно добавленные" },
  { id: "outfitCount", title: "По количеству образов" },
];

function ensureArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

export function normalizeWardrobeItemDraft(draft, previousItem, colorOptions = []) {
  const base = previousItem ?? {};
  const colorIds = ensureArray(draft.colorIds ?? base.colorIds);
  const colorDetails = resolveColorDetails(colorIds, colorOptions, draft.colorDetails ?? base.colorDetails);
  const seasons = ensureArray(draft.seasons ?? draft.season ?? base.seasons ?? base.season);
  const styles = ensureArray(draft.styles ?? draft.tags ?? base.styles ?? base.tags);
  const status = draft.status ?? base.status ?? "active";

  return {
    ...base,
    ...draft,
    image: draft.image ?? base.image ?? placeholderImage,
    title: (draft.title ?? base.title ?? "").trim(),
    catalogId: draft.catalogId ?? base.catalogId ?? "main",
    categoryId: draft.categoryId ?? base.categoryId ?? "tops",
    subcategory: draft.subcategory ?? base.subcategory ?? "",
    colorIds,
    colorDetails,
    brand: draft.brand ?? base.brand ?? "",
    size: draft.size ?? base.size ?? "",
    material: draft.material ?? base.material ?? "",
    seasons,
    season: seasons,
    styles,
    tags: styles,
    status,
    createdAt: draft.createdAt ?? base.createdAt ?? toISODate(new Date()),
    outfitCount: Number(draft.outfitCount ?? base.outfitCount ?? 0),
    isArchived: draft.isArchived ?? base.isArchived ?? status === "archived",
    notes: draft.notes ?? base.notes ?? "",
    sourceType: draft.sourceType ?? base.sourceType,
    primaryImageFileId: draft.primaryImageFileId ?? base.primaryImageFileId ?? null,
    colorPrediction: draft.colorPrediction ?? base.colorPrediction ?? null,
  };
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemWord(word) {
  let value = normalizeText(word);
  const patterns = [
    /ыми$/u,
    /ими$/u,
    /ого$/u,
    /ему$/u,
    /ому$/u,
    /ами$/u,
    /ями$/u,
    /ая$/u,
    /яя$/u,
    /ое$/u,
    /ее$/u,
    /ые$/u,
    /ие$/u,
    /ый$/u,
    /ий$/u,
    /ой$/u,
    /ую$/u,
    /юю$/u,
    /ов$/u,
    /ев$/u,
    /ом$/u,
    /ем$/u,
    /ам$/u,
    /ям$/u,
    /ах$/u,
    /ях$/u,
    /ы$/u,
    /и$/u,
    /а$/u,
    /я$/u,
    /о$/u,
    /е$/u,
  ];

  for (const pattern of patterns) {
    if (value.length > 4 && pattern.test(value)) {
      value = value.replace(pattern, "");
      break;
    }
  }

  return value;
}

function splitToSearchTokens(values) {
  return values
    .flatMap((value) => normalizeText(value).split(" "))
    .map((entry) => stemWord(entry))
    .filter(Boolean);
}

export function getOutfitCountMap(outfits) {
  return outfits.reduce((acc, outfit) => {
    for (const itemId of outfit.itemIds ?? []) {
      acc[itemId] = (acc[itemId] ?? 0) + 1;
    }
    return acc;
  }, {});
}

export function formatWardrobeItemCount(count) {
  const value = Math.abs(Number(count) || 0);
  const lastTwo = value % 100;
  const last = value % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return `${count} вещей`;
  }

  if (last === 1) {
    return `${count} вещь`;
  }

  if (last >= 2 && last <= 4) {
    return `${count} вещи`;
  }

  return `${count} вещей`;
}

export function matchesWardrobeSearch(item, query, categories, catalogs) {
  if (!query?.trim()) return true;

  const category = categories.find((entry) => entry.id === item.categoryId);
  const catalog = catalogs.find((entry) => entry.id === item.catalogId);
  const fieldTokens = splitToSearchTokens([
    item.title,
    category?.title,
    catalog?.title,
    item.subcategory,
    item.brand,
    item.material,
    item.size,
    item.status,
    ...getItemColorNames(item),
    ...(item.seasons ?? item.season ?? []),
    ...(item.styles ?? item.tags ?? []),
  ]);
  const queryTokens = splitToSearchTokens([query]);

  return queryTokens.every((token) =>
    fieldTokens.some((fieldToken) => fieldToken.includes(token) || token.includes(fieldToken))
  );
}

function includesValue(filterValue, actualValue) {
  if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return true;

  const actualValues = Array.isArray(actualValue) ? actualValue : [actualValue];
  const filterValues = Array.isArray(filterValue) ? filterValue : [filterValue];

  return filterValues.some((value) => actualValues.includes(value));
}

function matchesColorFilter(item, colorFilter) {
  if (!colorFilter?.length) return true;
  const actualColorIds = item.colorIds ?? [];
  const actualParentIds = (item.colorDetails ?? []).map((entry) => entry.parentColorId).filter(Boolean);
  return colorFilter.some((value) => actualColorIds.includes(value) || actualParentIds.includes(value));
}

export function applyWardrobeFilters(items, filters, outfitCountMap = {}) {
  return items.filter((item) => {
    if (!includesValue(filters.catalogId, item.catalogId)) return false;
    if (!includesValue(filters.categoryId, item.categoryId)) return false;
    if (!includesValue(filters.subcategory, item.subcategory)) return false;
    if (!matchesColorFilter(item, filters.color)) return false;
    if (!includesValue(filters.season, item.seasons ?? item.season ?? [])) return false;
    if (!includesValue(filters.style, item.styles ?? item.tags ?? [])) return false;
    if (!includesValue(filters.brand, item.brand)) return false;
    if (!includesValue(filters.size, item.size)) return false;
    if (!includesValue(filters.material, item.material)) return false;
    if (!includesValue(filters.status, item.status)) return false;

    if (filters.outfitParticipation === "withOutfits" && (outfitCountMap[item.id] ?? item.outfitCount ?? 0) === 0) {
      return false;
    }

    if (filters.outfitParticipation === "withoutOutfits" && (outfitCountMap[item.id] ?? item.outfitCount ?? 0) > 0) {
      return false;
    }

    return true;
  });
}

export function sortWardrobeItems(items, sortBy, outfitCountMap = {}) {
  const copy = items.slice();

  if (sortBy === "outfitCount") {
    return copy.sort(
      (left, right) =>
        (outfitCountMap[right.id] ?? right.outfitCount ?? 0) - (outfitCountMap[left.id] ?? left.outfitCount ?? 0)
    );
  }

  return copy.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, "ru"));
}

export function getWardrobeFilterOptions(items, colorOptions = []) {
  return {
    subcategories: unique(items.map((item) => item.subcategory)),
    colors: colorOptions,
    seasons: unique(items.flatMap((item) => item.seasons ?? item.season ?? [])),
    styles: unique(items.flatMap((item) => item.styles ?? item.tags ?? [])),
    brands: unique(items.map((item) => item.brand)),
    sizes: unique(items.map((item) => item.size)),
    materials: unique(items.map((item) => item.material)),
    statuses: unique(items.map((item) => item.status)),
  };
}

export function createDraftFromItem(item) {
  return normalizeWardrobeItemDraft(item);
}

export function getStatusMeta(statusId) {
  return WARDROBE_STATUSES.find((status) => status.id === statusId) ?? WARDROBE_STATUSES[0];
}

export function createEmptyWardrobeFilters(overrides = {}) {
  return {
    catalogId: [],
    categoryId: [],
    subcategory: [],
    color: [],
    season: [],
    style: [],
    brand: [],
    size: [],
    material: [],
    status: [],
    outfitParticipation: "",
    ...overrides,
  };
}
