import React from "react";
import { Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const CATEGORY_IMAGES = {
  all: require("../../assets/wardrobe-icons/all.png"),
  tops: require("../../assets/wardrobe-icons/tops.png"),
  bottoms: require("../../assets/wardrobe-icons/bottoms.png"),
  dresses: require("../../assets/wardrobe-icons/dresses.png"),
  one_piece: require("../../assets/wardrobe-icons/dresses.png"),
  outerwear: require("../../assets/wardrobe-icons/outerwear.png"),
  shoes: require("../../assets/wardrobe-icons/shoes.png"),
  accessories: require("../../assets/wardrobe-icons/accessories.png"),
  bags_accessories: require("../../assets/wardrobe-icons/accessories.png"),
};

const LEGACY_ICON_MAP = {
  "apps-outline": "all",
  "shirt-outline": "tops",
  "snow-outline": "outerwear",
  "footsteps-outline": "shoes",
  "bag-handle-outline": "accessories",
  "watch-outline": "accessories",
  pants: "bottoms",
  dress: "dresses",
  one_piece: "one_piece",
  bags_accessories: "bags_accessories",
};

export default function CategoryIcon({ categoryId, icon, size = 20, color }) {
  const rawKey = String(icon ?? categoryId ?? "").replace("flaticon-", "");
  const imageKey = CATEGORY_IMAGES[categoryId] ? categoryId : LEGACY_ICON_MAP[rawKey] ?? rawKey;
  const source = CATEGORY_IMAGES[imageKey];

  if (source) {
    return <Image source={source} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" />;
  }

  return <MaterialCommunityIcons name={icon ?? "tshirt-crew-outline"} size={size} color={color} />;
}
