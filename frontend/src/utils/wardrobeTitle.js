import { resolveColorDetails } from "./wardrobeColors";

const SUBCATEGORY_FORM_OVERRIDES = new Map([
  ["юбка", "feminine"],
  ["блузка", "feminine"],
  ["рубашка", "feminine"],
  ["кофта", "feminine"],
  ["куртка", "feminine"],
  ["шуба", "feminine"],
  ["сумка / рюкзак", "feminine"],
  ["платье", "neuter"],
  ["пальто", "neuter"],
  ["боди", "neuter"],
  ["поло", "neuter"],
  ["брюки", "plural"],
  ["джинсы", "plural"],
  ["шорты", "plural"],
  ["легинсы / тайтсы", "plural"],
  ["кроссовки / кеды", "plural"],
  ["ботинки", "plural"],
  ["сапоги", "plural"],
  ["туфли на каблуке", "plural"],
  ["сандалии", "plural"],
  ["очки", "plural"],
  ["перчатки", "plural"],
  ["украшения", "plural"],
]);

function normalizeSubcategoryKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function lowercaseFirst(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return `${text.slice(0, 1).toLowerCase()}${text.slice(1)}`;
}

function capitalizeFirst(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;
}

export function getSubcategoryGrammaticalForm(subcategory) {
  return SUBCATEGORY_FORM_OVERRIDES.get(normalizeSubcategoryKey(subcategory)) ?? "masculine";
}

export function inflectColorForSubcategory(colorName, subcategory) {
  const base = String(colorName ?? "").trim();
  if (!base) return "";

  const form = getSubcategoryGrammaticalForm(subcategory);
  const lower = base.toLowerCase();

  if (form === "masculine") {
    return capitalizeFirst(lower);
  }

  if (/(ый|ой)$/u.test(lower)) {
    if (form === "feminine") return capitalizeFirst(lower.replace(/(ый|ой)$/u, "ая"));
    if (form === "neuter") return capitalizeFirst(lower.replace(/(ый|ой)$/u, "ое"));
    if (form === "plural") return capitalizeFirst(lower.replace(/(ый|ой)$/u, "ые"));
  }

  if (/ий$/u.test(lower)) {
    if (form === "feminine") return capitalizeFirst(lower.replace(/ий$/u, "яя"));
    if (form === "neuter") return capitalizeFirst(lower.replace(/ий$/u, "ее"));
    if (form === "plural") return capitalizeFirst(lower.replace(/ий$/u, "ие"));
  }

  return capitalizeFirst(lower);
}

export function buildDefaultItemTitle(colorSource, subcategory, colorOptions = []) {
  const cleanSubcategory = lowercaseFirst(subcategory);
  if (!cleanSubcategory) {
    return "";
  }

  const colorDetails = Array.isArray(colorSource)
    ? resolveColorDetails(
        colorSource.map((entry) => (typeof entry === "string" ? entry : entry?.id)).filter(Boolean),
        colorOptions,
        colorSource.every((entry) => typeof entry === "object") ? colorSource : []
      )
    : [];
  const primaryColorName = colorDetails[0]?.name ?? "";
  const inflectedColor = inflectColorForSubcategory(primaryColorName, cleanSubcategory);
  if (!inflectedColor) {
    return "";
  }

  return `${inflectedColor} ${cleanSubcategory}`.trim();
}
