/** @typedef {{ id: string; title: string; itemIds: string[]; tags: string[]; season: string[] }} Outfit */

/** @type {Outfit[]} */
export const initialOutfits = [
  {
    id: "outfit_1",
    title: "Офис: минимализм",
    itemIds: ["item_1", "item_2", "item_4"],
    tags: ["office", "classic"],
    season: ["осень", "зима"],
  },
  {
    id: "outfit_2",
    title: "Кэжуал на каждый день",
    itemIds: ["item_11", "item_2", "item_5"],
    tags: ["casual"],
    season: ["весна", "лето", "осень"],
  },
  {
    id: "outfit_3",
    title: "Тепло и уютно",
    itemIds: ["item_3", "item_2", "item_6", "item_8"],
    tags: ["warm", "casual"],
    season: ["зима"],
  },
  {
    id: "outfit_4",
    title: "Лето: лёгкий офис",
    itemIds: ["item_1", "item_9", "item_5"],
    tags: ["office"],
    season: ["лето"],
  },
  {
    id: "outfit_5",
    title: "Вечер",
    itemIds: ["item_12", "item_7"],
    tags: ["evening"],
    season: ["лето"],
  },
];

