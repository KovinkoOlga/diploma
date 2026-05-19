export const wardrobeCategories = [
  {
    id: "tops",
    title: "Верх",
    icon: "tops",
    subcategories: ["Футболки", "Рубашки", "Свитеры", "Худи", "Топы"],
  },
  {
    id: "bottoms",
    title: "Низ",
    icon: "bottoms",
    subcategories: ["Джинсы", "Брюки", "Юбки", "Шорты"],
  },
  {
    id: "dresses",
    title: "Слитное",
    icon: "dresses",
    subcategories: ["Платья", "Комбинезоны"],
  },
  {
    id: "outerwear",
    title: "Верхняя одежда",
    icon: "outerwear",
    subcategories: ["Пальто", "Куртки", "Тренчи", "Жилеты"],
  },
  {
    id: "shoes",
    title: "Обувь",
    icon: "shoes",
    subcategories: ["Кроссовки", "Ботинки", "Туфли", "Сандалии"],
  },
  {
    id: "accessories",
    title: "Сумки и аксессуары",
    icon: "accessories",
    subcategories: ["Шоперы", "Кросс-боди", "Рюкзаки", "Клатчи", "Шарфы", "Украшения", "Ремни", "Головные уборы"],
  },
];

export const wardrobeVirtualCategories = [{ id: "all", title: "Все вещи", icon: "all" }];

export const wardrobeCategoryTiles = [...wardrobeVirtualCategories, ...wardrobeCategories];
export const categories = wardrobeCategories;

export function getCategoryById(categoryId, categories = wardrobeCategories) {
  return categories.find((category) => category.id === categoryId);
}

export function getCategoryTitle(categoryId, categories = wardrobeCategories) {
  return getCategoryById(categoryId, categories)?.title ?? "Категория";
}
