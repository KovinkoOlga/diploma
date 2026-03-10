/** @typedef {{ id: string; title: string; icon: string }} Category */

/** @type {Category[]} */
export const categories = [
  { id: "outerwear", title: "Верхняя одежда", icon: "snow-outline" },
  { id: "tops", title: "Верх", icon: "shirt-outline" },
  { id: "bottoms", title: "Низ", icon: "walk-outline" },
  { id: "shoes", title: "Обувь", icon: "footsteps-outline" },
  { id: "accessories", title: "Аксессуары", icon: "watch-outline" },
  { id: "bags", title: "Сумки", icon: "bag-outline" },
];

export function getCategoryById(categoryId) {
  return categories.find((category) => category.id === categoryId);
}
