import React from "react";
import { useAppTheme } from "../theme/ThemeProvider";
import GridTile from "./GridTile";
import { formatOutfitItemCount } from "../utils/outfits";

function buildSubtitle(outfit, items) {
  const parts = [formatOutfitItemCount(items.length)];
  const styleTitle = outfit?.tags?.[0];
  const seasonTitle = outfit?.season?.slice(0, 2).join(", ");
  const collectionTitle =
    outfit?.collections?.length > 1
      ? `${outfit.collections[0].title} +${outfit.collections.length - 1}`
      : outfit?.collections?.[0]?.title;

  parts.push(styleTitle || seasonTitle || "без стиля");

  if (collectionTitle) {
    parts.push(collectionTitle);
  } else if (styleTitle && seasonTitle) {
    parts.push(seasonTitle);
  }

  return parts.filter(Boolean).join(" · ");
}

export default function OutfitCard({ outfit, items, onPress, selected = false }) {
  const { colors, radius, spacing } = useAppTheme();
  const cover = outfit?.coverTransparentImage ?? outfit?.coverImage ?? items?.[0]?.image;

  return (
    <GridTile
      image={cover}
      title={outfit.title}
      subtitle={buildSubtitle(outfit, items)}
      containerStyle={{
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? colors.text : "rgba(17,17,17,0.14)",
        borderRadius: radius.lg,
        backgroundColor: colors.background,
        padding: spacing.xs,
      }}
      onPress={onPress}
    />
  );
}
