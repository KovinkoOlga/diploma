export const initialCatalogs = [
  {
    id: "main",
    title: "Основное",
    description: "База на каждый день",
  },
  {
    id: "home",
    title: "Домашнее",
    description: "Комфортные вещи для дома",
  },
  {
    id: "sport",
    title: "Тренировочное",
    description: "Форма и вещи для активности",
  },
];

export function getCatalogById(catalogId, catalogs = initialCatalogs) {
  return catalogs.find((catalog) => catalog.id === catalogId);
}
