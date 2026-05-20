export const SPECIAL_COLOR_IDS = new Set(["multicolor", "transparent"]);
export const EXCLUSIVE_COLOR_IDS = new Set(["multicolor", "transparent"]);

export function buildColorOptionMap(colorOptions = []) {
  return Object.fromEntries((colorOptions ?? []).map((option) => [option.id, option]));
}

export function getLeafColorOptions(colorOptions = []) {
  return (colorOptions ?? []).filter((option) => option.parentColorId);
}

export function groupLeafColorOptions(colorOptions = []) {
  const groups = [];
  const leafOptions = getLeafColorOptions(colorOptions);
  const byParentName = new Map();

  for (const option of leafOptions) {
    const key = option.parentName ?? "Без группы";
    if (!byParentName.has(key)) {
      byParentName.set(key, []);
      groups.push({ title: key, options: byParentName.get(key) });
    }
    byParentName.get(key).push(option);
  }

  return groups;
}

export function resolveColorDetails(colorIds = [], colorOptions = [], fallbackDetails = []) {
  if (Array.isArray(fallbackDetails) && fallbackDetails.length) {
    return fallbackDetails;
  }
  const colorMap = buildColorOptionMap(colorOptions);
  return (colorIds ?? []).map((colorId) => colorMap[colorId]).filter(Boolean);
}

export function formatColorSelectionLabel(colorDetails = [], emptyLabel = "Не выбрано") {
  const details = (colorDetails ?? []).filter(Boolean);
  if (!details.length) {
    return emptyLabel;
  }

  return details.map((entry) => entry.name).join(", ");
}

export function getItemColorNames(item) {
  return (item?.colorDetails ?? []).map((entry) => entry.name).filter(Boolean);
}

export function getPrimaryItemColorName(item) {
  return getItemColorNames(item)[0] ?? "";
}

export function toggleColorSelection(currentColorIds = [], colorId, colorOptionsById = {}) {
  const current = Array.isArray(currentColorIds) ? currentColorIds : [];
  if (current.includes(colorId)) {
    return current.filter((entry) => entry !== colorId);
  }

  const option = colorOptionsById[colorId];
  if (!option || !option.parentColorId) {
    return current;
  }

  if (EXCLUSIVE_COLOR_IDS.has(colorId)) {
    return [colorId];
  }

  const withoutExclusive = current.filter((entry) => !EXCLUSIVE_COLOR_IDS.has(entry));
  const next = [...withoutExclusive, colorId];
  if (next.length <= 2) {
    return next;
  }
  return [withoutExclusive[withoutExclusive.length - 1], colorId].filter(Boolean);
}

export function toggleFilterColorSelection(currentColorIds = [], colorId) {
  const current = Array.isArray(currentColorIds) ? currentColorIds : [];
  if (current.includes(colorId)) {
    return current.filter((entry) => entry !== colorId);
  }
  return [...current, colorId];
}
