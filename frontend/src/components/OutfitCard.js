import React from "react";
import { useAppTheme } from "../theme/ThemeProvider";
import GridTile from "./GridTile";

export default function OutfitCard({ outfit, items, onPress }) {
  const { colors } = useAppTheme();
  const cover = items?.[0]?.image;

  return (
    <GridTile
      image={cover}
      title={outfit.title}
      subtitle={`${items.length} вещей · ${(outfit.tags ?? []).join(", ") || "капсула"}`}
      badge={outfit.season?.[0] ?? "образ"}
      onPress={onPress}
      colors={colors}
    />
  );
}
