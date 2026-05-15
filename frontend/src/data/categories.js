export const wardrobeCategories = [
  {
    id: "tops",
    title: "Верх",
    icon: "shirt-outline",
    subcategories: ["Футболки", "Рубашки", "Свитеры", "Худи", "Топы"],
  },
  {
    id: "bottoms",
    title: "Низ",
    icon: "swap-vertical-outline",
    subcategories: ["Джинсы", "Брюки", "Юбки", "Шорты"],
  },
  {
    id: "dresses",
    title: "Платья / комбинезоны",
    icon: "woman-outline",
    subcategories: ["Платья", "Комбинезоны"],
  },
  {
    id: "outerwear",
    title: "Верхняя одежда",
    icon: "snow-outline",
    subcategories: ["Пальто", "Куртки", "Тренчи", "Жилеты"],
  },
  {
    id: "shoes",
    title: "Обувь",
    icon: "footsteps-outline",
    subcategories: ["Кроссовки", "Ботинки", "Туфли", "Сандалии"],
  },
  {
    id: "bags",
    title: "Сумки",
    icon: "bag-handle-outline",
    subcategories: ["Шоперы", "Кросс-боди", "Рюкзаки", "Клатчи"],
  },
  {
    id: "accessories",
    title: "Аксессуары",
    icon: "watch-outline",
    subcategories: ["Шарфы", "Украшения", "Ремни", "Головные уборы"],
  },
];

export const wardrobeVirtualCategories = [{ id: "all", title: "Все вещи", icon: "apps-outline" }];

export const wardrobeCategoryTiles = [...wardrobeVirtualCategories, ...wardrobeCategories];
export const categories = wardrobeCategories;

export function getCategoryById(categoryId, categories = wardrobeCategories) {
  return categories.find((category) => category.id === categoryId);
}

export function getCategoryTitle(categoryId, categories = wardrobeCategories) {
  return getCategoryById(categoryId, categories)?.title ?? "Категория";
}
