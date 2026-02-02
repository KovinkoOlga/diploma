/** @typedef {{ id: string; author: string; text: string; tags: string[]; outfitId?: string; likes: number; saved: boolean }} FeedPost */

/** @type {FeedPost[]} */
export const initialFeedPosts = [
  {
    id: "post_1",
    author: "Stylist Daily",
    text: "Идея: добавьте один акцентный аксессуар к строгому образу — и он заиграет.",
    tags: ["office", "classic"],
    outfitId: "outfit_1",
    likes: 128,
    saved: false,
  },
  {
    id: "post_2",
    author: "Minimal Mood",
    text: "Белая рубашка + джинсы — база, которую можно усложнять фактурами.",
    tags: ["casual"],
    outfitId: "outfit_2",
    likes: 256,
    saved: true,
  },
  {
    id: "post_3",
    author: "Warm Seasons",
    text: "Слойность: тонкий свитер + пальто + шарф. Супер для зимы.",
    tags: ["warm", "winter"],
    outfitId: "outfit_3",
    likes: 93,
    saved: false,
  },
  {
    id: "post_4",
    author: "Color Note",
    text: "Синий низ в летнем офисе смотрится свежо и при этом спокойно.",
    tags: ["office", "summer"],
    outfitId: "outfit_4",
    likes: 74,
    saved: false,
  },
  {
    id: "post_5",
    author: "Evening Edit",
    text: "Черное платье — ваш лучший друг. Оставьте силуэт чистым, добавьте сумку-акцент.",
    tags: ["evening"],
    outfitId: "outfit_5",
    likes: 311,
    saved: true,
  },
];

