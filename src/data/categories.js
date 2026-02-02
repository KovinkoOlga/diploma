/** @typedef {{ id: string; title: string; icon: string; tone: "blue"|"violet"|"green"|"orange"|"pink"|"graphite" }} Category */

/** @type {Category[]} */
export const categories = [
  { id: "outerwear", title: "Верхняя одежда", icon: "snow", tone: "blue" },
  { id: "tops", title: "Верх", icon: "shirt-outline", tone: "violet" },
  { id: "bottoms", title: "Низ", icon: "walk-outline", tone: "graphite" },
  { id: "shoes", title: "Обувь", icon: "footsteps-outline", tone: "orange" },
  { id: "accessories", title: "Аксессуары", icon: "watch-outline", tone: "pink" },
  { id: "bags", title: "Сумки", icon: "bag-outline", tone: "green" },
];

export function getCategoryById(categoryId) {
  return categories.find((c) => c.id === categoryId);
}

