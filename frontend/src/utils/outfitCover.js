import {
  normalizeImageSource,
  resolveOutfitCoverItemImageSource,
} from "./outfitImageSource";

const DEFAULT_CANVAS = {
  width: 1080,
  height: 1350,
  background: "transparent",
  previewBackground: "#FFFFFF",
};

const MAX_OBJECTS = 20;
const MIN_OBJECT_SCALE = 0.25;
const MAX_OBJECT_SCALE = 4.2;
const OBJECT_BASE_WIDTH_FULL = 228;
const OBJECT_BASE_WIDTH_HALF = 114;
const OBJECT_BASE_HEIGHT = 320;

const DEFAULT_CATEGORY_KEY = "default";

const CATEGORY_PLACEMENT = {
  tops: { x: 0.48, y: 0.22, initialScale: 1.16, spreadX: 58, spreadY: 28 },
  outerwear: { x: 0.67, y: 0.2, initialScale: 1.2, spreadX: 60, spreadY: 32 },
  bottoms: { x: 0.49, y: 0.56, initialScale: 1.12, spreadX: 54, spreadY: 34 },
  shoes: { x: 0.5, y: 0.83, initialScale: 0.9, spreadX: 50, spreadY: 18 },
  dresses: { x: 0.5, y: 0.45, initialScale: 1.25, spreadX: 40, spreadY: 34 },
  bags: { x: 0.79, y: 0.52, initialScale: 0.88, spreadX: 42, spreadY: 24 },
  accessories: { x: 0.22, y: 0.31, initialScale: 0.78, spreadX: 36, spreadY: 20 },
  default: { x: 0.5, y: 0.5, initialScale: 1, spreadX: 52, spreadY: 32 },
};

const CATEGORY_ALIASES = {
  top: "tops",
  tops: "tops",
  t_shirt: "tops",
  tshirt: "tops",
  blouse: "tops",
  shirt: "tops",
  sweater: "tops",
  hoodie: "tops",

  outerwear: "outerwear",
  jacket: "outerwear",
  coat: "outerwear",
  blazer: "outerwear",

  bottoms: "bottoms",
  bottom: "bottoms",
  pants: "bottoms",
  jeans: "bottoms",
  shorts: "bottoms",
  skirt: "bottoms",

  shoes: "shoes",
  shoe: "shoes",
  footwear: "shoes",

  dress: "dresses",
  dresses: "dresses",
  jumpsuit: "dresses",

  bag: "bags",
  bags: "bags",

  accessory: "accessories",
  accessories: "accessories",
  jewelry: "accessories",
};

const PLACEMENT_PATTERN = [
  { x: 0, y: 0 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
  { x: -1, y: 2 },
  { x: 1, y: 2 },
  { x: 0, y: 3 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeCrop(value) {
  if (value === "left-half" || value === "right-half") return value;
  return "none";
}

function normalizeCategoryToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/giu, "_")
    .replace(/^_+|_+$/g, "");
}

export function resolveCoverObjectCategory(item) {
  const candidates = [item?.categoryId, item?.subcategory, item?.category];

  for (const candidate of candidates) {
    const token = normalizeCategoryToken(candidate);
    if (!token) continue;
    const alias = CATEGORY_ALIASES[token];
    if (alias) return alias;
  }

  return DEFAULT_CATEGORY_KEY;
}

export function getCategoryPlacementConfig(itemOrCategory) {
  const category =
    typeof itemOrCategory === "string"
      ? CATEGORY_ALIASES[normalizeCategoryToken(itemOrCategory)] ?? itemOrCategory
      : resolveCoverObjectCategory(itemOrCategory);
  return CATEGORY_PLACEMENT[category] ?? CATEGORY_PLACEMENT[DEFAULT_CATEGORY_KEY];
}

export function getCoverObjectBaseSize(crop) {
  return {
    widthBase: crop === "none" ? OBJECT_BASE_WIDTH_FULL : OBJECT_BASE_WIDTH_HALF,
    heightBase: OBJECT_BASE_HEIGHT,
  };
}

export function getCoverObjectDisplayMetrics(object = {}) {
  const { widthBase, heightBase } = getCoverObjectBaseSize(normalizeCrop(object?.crop));
  const scale = clamp(Number(object?.scale) || 1, MIN_OBJECT_SCALE, MAX_OBJECT_SCALE);

  return {
    widthBase,
    heightBase,
    scale,
    width: widthBase * scale,
    height: heightBase * scale,
  };
}

export function getCoverObjectSize(object) {
  return getCoverObjectDisplayMetrics(object);
}

export function normalizeCoverImageSource(source) {
  return normalizeImageSource(source);
}

export function resolveItemImageSource(item) {
  return resolveOutfitCoverItemImageSource(item);
}

export function getInitialCoverObjectPlacement(item, canvas, index = 0, categoryIndex = 0) {
  const categoryKey = resolveCoverObjectCategory(item);
  const config = getCategoryPlacementConfig(categoryKey);
  const pattern = PLACEMENT_PATTERN[categoryIndex % PLACEMENT_PATTERN.length] ?? PLACEMENT_PATTERN[0];
  const laneOffset = Math.floor(categoryIndex / PLACEMENT_PATTERN.length);

  const initialScale = clamp(config.initialScale ?? 1, MIN_OBJECT_SCALE, MAX_OBJECT_SCALE);
  const metrics = getCoverObjectDisplayMetrics({ crop: "none", scale: initialScale });

  const rawX =
    config.x * canvas.width + pattern.x * config.spreadX + (index % 2 === 0 ? -1 : 1) * Math.min(18, Math.abs(config.spreadX) * 0.28);
  const rawY = config.y * canvas.height + pattern.y * config.spreadY + laneOffset * Math.max(12, Math.floor((config.spreadY || 18) * 0.45));

  const minX = metrics.width / 2 + 20;
  const maxX = canvas.width - metrics.width / 2 - 20;
  const minY = metrics.height / 2 + 20;
  const maxY = canvas.height - metrics.height / 2 - 20;

  const x = clamp(rawX, minX, maxX);
  const y = clamp(rawY, minY, maxY);

  return {
    x: Math.round(x),
    y: Math.round(y),
    scale: initialScale,
    categoryKey,
  };
}

export function clampCoverObjectPatchToCanvas(object, canvas, patch = {}) {
  const nextObject = { ...object, ...patch };
  const { width, height } = getCoverObjectDisplayMetrics(nextObject);
  const halfW = width / 2;
  const halfH = height / 2;
  const minX = halfW;
  const maxX = canvas.width - halfW;
  const minY = halfH;
  const maxY = canvas.height - halfH;

  return {
    ...patch,
    x: clamp(Number(nextObject.x) || 0, minX, maxX),
    y: clamp(Number(nextObject.y) || 0, minY, maxY),
  };
}

function createObject(itemId, item, zIndex, canvas, index, categoryIndex) {
  const placement = getInitialCoverObjectPlacement(item, canvas, index, categoryIndex);

  return {
    id: `cover_obj_${itemId}`,
    itemId,
    x: placement.x,
    y: placement.y,
    scale: placement.scale,
    rotation: 0,
    flipX: false,
    crop: "none",
    zIndex,
  };
}

export function createBaseCoverEditorState(itemIds, itemById, existingState = null) {
  const sourceItemIds = (itemIds ?? []).filter(Boolean).slice(0, MAX_OBJECTS);
  const base = {
    mode: "composition",
    canvas: { ...DEFAULT_CANVAS },
    objects: [],
  };

  const makeCategoryCounter = () => {
    const counter = new Map();
    return {
      next(item) {
        const key = resolveCoverObjectCategory(item);
        const current = counter.get(key) ?? 0;
        counter.set(key, current + 1);
        return current;
      },
      seed(item) {
        const key = resolveCoverObjectCategory(item);
        counter.set(key, (counter.get(key) ?? 0) + 1);
      },
    };
  };

  if (!existingState || typeof existingState !== "object") {
    const categoryCounter = makeCategoryCounter();
    base.objects = sourceItemIds.map((itemId, index) => {
      const item = itemById[itemId];
      const categoryIndex = categoryCounter.next(item);
      return createObject(itemId, item, index, base.canvas, index, categoryIndex);
    });
    return base;
  }

  const existingObjects = Array.isArray(existingState.objects) ? existingState.objects : [];
  const objectByItemId = Object.fromEntries(existingObjects.map((entry) => [entry.itemId, entry]));
  const sourceOrderByItemId = Object.fromEntries(sourceItemIds.map((itemId, index) => [itemId, index]));
  const canvas = {
    ...DEFAULT_CANVAS,
    ...(existingState.canvas ?? {}),
  };

  const existingSorted = sourceItemIds
    .map((itemId) => objectByItemId[itemId])
    .filter(Boolean)
    .sort((left, right) => (Number(left.zIndex) || 0) - (Number(right.zIndex) || 0));

  const maxExistingZ = existingSorted.length ? Math.max(...existingSorted.map((entry) => Number(entry.zIndex) || 0)) : -1;
  const categoryCounter = makeCategoryCounter();

  for (const existing of existingSorted) {
    categoryCounter.seed(itemById[existing.itemId]);
  }

  const newObjectIds = sourceItemIds.filter((itemId) => !objectByItemId[itemId]);
  const newObjects = newObjectIds.map((itemId, index) => {
    const item = itemById[itemId];
    const categoryIndex = categoryCounter.next(item);
    return createObject(itemId, item, maxExistingZ + 1 + index, canvas, sourceOrderByItemId[itemId] ?? index, categoryIndex);
  });

  const normalizedExisting = existingSorted.map((existing) => ({
    id: existing.id || `cover_obj_${existing.itemId}`,
    itemId: existing.itemId,
    x: Number.isFinite(existing.x) ? existing.x : canvas.width / 2,
    y: Number.isFinite(existing.y) ? existing.y : canvas.height / 2,
    scale: clamp(Number(existing.scale) || 1, MIN_OBJECT_SCALE, MAX_OBJECT_SCALE),
    rotation: Number.isFinite(existing.rotation) ? existing.rotation : 0,
    flipX: Boolean(existing.flipX),
    crop: normalizeCrop(existing.crop),
    zIndex: Number.isFinite(existing.zIndex) ? existing.zIndex : 0,
  }));

  const objects = [...normalizedExisting, ...newObjects]
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((entry, index) => ({ ...entry, zIndex: index }));

  return {
    ...base,
    mode: "composition",
    canvas,
    objects,
  };
}

export function syncCoverStateWithItems(coverMode, coverEditorStateJson, itemIds, itemById) {
  if (coverMode !== "composition") return coverEditorStateJson;
  return createBaseCoverEditorState(itemIds, itemById, coverEditorStateJson);
}

export function updateCoverObject(state, itemId, patch) {
  if (!state?.objects?.length) return state;
  const nextObjects = state.objects.map((entry) => {
    if (entry.itemId !== itemId) return entry;
    const updated = { ...entry, ...patch };
    if (Object.prototype.hasOwnProperty.call(patch, "scale")) {
      updated.scale = clamp(Number(updated.scale) || 1, MIN_OBJECT_SCALE, MAX_OBJECT_SCALE);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "crop")) {
      updated.crop = normalizeCrop(updated.crop);
    }
    return updated;
  });
  return { ...state, objects: nextObjects };
}

export function reorderCoverObject(state, itemId, action) {
  if (!state?.objects?.length) return state;
  const sorted = state.objects
    .map((entry) => ({ ...entry }))
    .sort((left, right) => left.zIndex - right.zIndex);
  const index = sorted.findIndex((entry) => entry.itemId === itemId);
  if (index === -1) return state;

  const move = (from, to) => {
    const copy = sorted.slice();
    const [picked] = copy.splice(from, 1);
    copy.splice(to, 0, picked);
    return copy.map((entry, idx) => ({ ...entry, zIndex: idx }));
  };

  let next;
  if (action === "front") next = move(index, sorted.length - 1);
  else if (action === "back") next = move(index, 0);
  else if (action === "up" && index < sorted.length - 1) next = move(index, index + 1);
  else if (action === "down" && index > 0) next = move(index, index - 1);
  else next = sorted;

  return { ...state, objects: next };
}

export function removeCoverObject(state, itemId) {
  if (!state?.objects?.length) return state;
  const nextObjects = state.objects
    .filter((entry) => entry.itemId !== itemId)
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((entry, index) => ({ ...entry, zIndex: index }));
  return { ...state, objects: nextObjects };
}

export function defaultOutfitDraft(existing, seedItemId = null) {
  const baseItemIds = existing?.itemIds ?? [];
  const itemIds = seedItemId && !baseItemIds.includes(seedItemId) ? [seedItemId, ...baseItemIds] : baseItemIds;

  return {
    id: existing?.id,
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    season: existing?.season?.length ? existing.season : ["весна"],
    tags: existing?.tags?.length ? existing.tags.slice(0, 1) : ["casual"],
    itemIds,
    coverMode: existing?.coverMode ?? "none",
    coverFileId: existing?.coverFileId ?? null,
    coverImageUrl: existing?.coverImageUrl ?? null,
    coverTransparentImageUrl: existing?.coverTransparentImageUrl ?? null,
    coverImage:
      existing?.coverTransparentImage ??
      existing?.coverImage ??
      (existing?.coverTransparentImageUrl ? { uri: existing.coverTransparentImageUrl } : existing?.coverImageUrl ? { uri: existing.coverImageUrl } : null),
    coverTransparentImage:
      existing?.coverTransparentImage ??
      (existing?.coverTransparentImageUrl ? { uri: existing.coverTransparentImageUrl } : null),
    coverEditorStateJson: existing?.coverEditorStateJson ?? null,
  };
}

export {
  DEFAULT_CANVAS,
  MAX_OBJECTS,
  MIN_OBJECT_SCALE,
  MAX_OBJECT_SCALE,
  OBJECT_BASE_WIDTH_FULL,
  OBJECT_BASE_WIDTH_HALF,
  OBJECT_BASE_HEIGHT,
};
