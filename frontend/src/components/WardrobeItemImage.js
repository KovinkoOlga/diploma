import React from "react";
import MediaPreview from "./MediaPreview";
import { useAppTheme } from "../theme/ThemeProvider";

export default function WardrobeItemImage({ source, containerStyle, placeholderScale = 0.5, backgroundColor = null }) {
  const { colors } = useAppTheme();

  return (
    <MediaPreview
      source={source}
      resizeMode="contain"
      placeholderScale={placeholderScale}
      containerStyle={[
        {
          aspectRatio: 1,
          backgroundColor: backgroundColor ?? colors.background,
        },
        containerStyle,
      ]}
    />
  );
}
