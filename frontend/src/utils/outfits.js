import { splitSearchTokens } from "./search";
import { getItemColorNames } from "./wardrobeColors";

export const ALL_OUTFITS_COLLECTION_ID = "__all_outfits__";

export const OUTFIT_SORT_OPTIONS = [
  { id: "recent", title: "Сначала новые" },
  { id: "oldest", title: "Сначала старые" },
];

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => String(left).localeCompare(String(right), "ru"));
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

function getOutfitItems(outfit, itemById) {
  return (outfit?.itemIds ?? []).map((itemId) => itemById[itemId]).filter(Boolean);
}

function matchesOutfitItemFilters(items, filters) {
  if (!filters.categoryId?.length && !filters.subcategory?.length && !filters.catalogId?.length && !filters.color?.length && !filters.brand?.length && !filters.status?.length) {
    if (!filters.season?.length && !filters.style?.length) {
      return true;
    }
  }

  return items.some((item) => {
    if (!includesValue(filters.categoryId, item.categoryId)) return false;
    if (!includesValue(filters.subcategory, item.subcategory)) return false;
    if (!includesValue(filters.catalogId, item.catalogId)) return false;
    if (!matchesColorFilter(item, filters.color)) return false;
    if (!includesValue(filters.brand, item.brand)) return false;
    if (!includesValue(filters.status, item.status)) return false;
    return true;
  });
}

export function formatOutfitCount(count) {
  const value = Math.abs(Number(count) || 0);
  const lastTwo = value % 100;
  const last = value % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return `${count} образов`;
  }

  if (last === 1) {
    return `${count} образ`;
  }

  if (last >= 2 && last <= 4) {
    return `${count} образа`;
  }

  return `${count} образов`;
}

export function formatOutfitItemCount(count) {
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

export function normalizeOutfitSelectableName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*[_/\\-]+\s*/g, " ")
    .replace(/\s+/g, " ");
}

export function createEmptyOutfitFilters(overrides = {}) {
  return {
    collectionIds: [],
    season: [],
    style: [],
    categoryId: [],
    subcategory: [],
    catalogId: [],
    color: [],
    brand: [],
    status: [],
    withoutCollection: false,
    ...overrides,
  };
}

export function countOutfitFilters(filters, { includeCollection = true, includeWithoutCollection = true } = {}) {
  return Object.entries(filters).reduce((count, [field, value]) => {
    if (field === "collectionIds" && !includeCollection) return count;
    if (field === "withoutCollection" && !includeWithoutCollection) return count;
    if (Array.isArray(value)) return count + value.length;
    return count + (value ? 1 : 0);
  }, 0);
}

export function matchesOutfitSearch(outfit, query, context) {
  if (!query?.trim()) return true;

  const { itemById = {}, categoriesById = {}, catalogsById = {} } = context ?? {};
  const outfitItems = getOutfitItems(outfit, itemById);
  const fieldTokens = splitSearchTokens([
    outfit.title,
    outfit.description,
    ...(outfit.season ?? []),
    ...(outfit.tags ?? []),
    ...((outfit.collections ?? []).map((collection) => collection.title)),
    ...outfitItems.flatMap((item) => [
      item.title,
      catalogsById[item.catalogId]?.title,
      categoriesById[item.categoryId]?.title,
      item.subcategory,
      item.brand,
      item.status,
      ...getItemColorNames(item),
      ...(item.seasons ?? item.season ?? []),
      ...(item.styles ?? item.tags ?? []),
    ]),
  ]);
  const queryTokens = splitSearchTokens([query]);

  return queryTokens.every((token) =>
    fieldTokens.some((fieldToken) => fieldToken.includes(token) || token.includes(fieldToken))
  );
}

export function applyOutfitFilters(outfits, filters, context = {}) {
  const { activeCollectionId = ALL_OUTFITS_COLLECTION_ID, itemById = {} } = context;

  return outfits.filter((outfit) => {
    const collectionIds = outfit.collectionIds ?? [];

    if (activeCollectionId !== ALL_OUTFITS_COLLECTION_ID && !collectionIds.includes(activeCollectionId)) {
      return false;
    }

    if (activeCollectionId === ALL_OUTFITS_COLLECTION_ID && ((filters.collectionIds ?? []).length || filters.withoutCollection)) {
      const matchesSelectedCollection = (filters.collectionIds ?? []).some((collectionId) => collectionIds.includes(collectionId));
      const matchesWithoutCollection = Boolean(filters.withoutCollection) && collectionIds.length === 0;
      if (!matchesSelectedCollection && !matchesWithoutCollection) {
        return false;
      }
    }

    if (!includesValue(filters.season, outfit.season ?? [])) return false;
    if (!includesValue(filters.style, outfit.tags ?? [])) return false;

    const outfitItems = getOutfitItems(outfit, itemById);
    if (!matchesOutfitItemFilters(outfitItems, filters)) return false;

    if (filters.season?.length) {
      const itemMatchesSeason = outfitItems.some((item) => includesValue(filters.season, item.seasons ?? item.season ?? []));
      const outfitMatchesSeason = includesValue(filters.season, outfit.season ?? []);
      if (!outfitMatchesSeason && !itemMatchesSeason) return false;
    }

    if (filters.style?.length) {
      const itemMatchesStyle = outfitItems.some((item) => includesValue(filters.style, item.styles ?? item.tags ?? []));
      const outfitMatchesStyle = includesValue(filters.style, outfit.tags ?? []);
      if (!outfitMatchesStyle && !itemMatchesStyle) return false;
    }

    return true;
  });
}

export function sortOutfits(outfits, sortBy = "recent") {
  const copy = outfits.slice();

  if (sortBy === "oldest") {
    return copy.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  }

  return copy.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function getOutfitFilterOptions(outfits, context = {}) {
  const {
    itemById = {},
    categories = [],
    catalogs = [],
    colorOptions = [],
    seasonOptions = [],
    styleOptions = [],
    statusOptions = [],
    outfitCollections = [],
  } = context;
  const items = outfits.flatMap((outfit) => getOutfitItems(outfit, itemById));
  const usedCategoryIds = new Set(items.map((item) => item.categoryId).filter(Boolean));
  const usedCatalogIds = new Set(items.map((item) => item.catalogId).filter(Boolean));
  const usedCollectionIds = new Set(outfits.flatMap((outfit) => outfit.collectionIds ?? []));

  return {
    collections: outfitCollections.filter((collection) => usedCollectionIds.has(collection.id)),
    categories: categories.filter((category) => usedCategoryIds.has(category.id)),
    catalogs: catalogs.filter((catalog) => usedCatalogIds.has(catalog.id)),
    subcategories: unique(items.map((item) => item.subcategory)),
    colors: colorOptions,
    seasons: seasonOptions.length ? seasonOptions : unique(outfits.flatMap((outfit) => outfit.season ?? [])),
    styles: styleOptions.length ? styleOptions : unique(outfits.flatMap((outfit) => outfit.tags ?? [])),
    brands: unique(items.map((item) => item.brand)),
    statuses: statusOptions.length ? statusOptions : unique(items.map((item) => item.status)),
  };
}
