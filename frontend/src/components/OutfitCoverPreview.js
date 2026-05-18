import React from "react";
import { Text, View } from "react-native";
import MediaPreview from "./MediaPreview";
import { useAppTheme } from "../theme/ThemeProvider";

export default function OutfitCoverPreview({ draft, previewItems }) {
  const { colors, radius, spacing, typography } = useAppTheme();

  const previewFromItems = (previewItems ?? []).slice(0, 3);

  const cover = draft?.coverTransparentImage ?? draft?.coverImage;

  if (cover) {
    return (
      <MediaPreview
        source={cover}
        containerStyle={{
          width: "100%",
          aspectRatio: 0.82,
          borderRadius: radius.lg,
          backgroundColor: colors.background,
          marginTop: spacing.sm,
        }}
        placeholderScale={0.48}
      />
    );
  }

  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.sm }}>
      {previewFromItems.map((item) => (
        <MediaPreview
          key={item.id}
          source={item.image}
          placeholderScale={0.48}
          containerStyle={{
            flex: 1,
            aspectRatio: 0.82,
            borderRadius: radius.md,
            backgroundColor: colors.background,
          }}
        />
      ))}
      {!previewFromItems.length ? (
        <View
          style={{
            flex: 1,
            aspectRatio: 1.2,
            borderRadius: radius.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <Text style={[typography.caption, { color: colors.secondaryText }]}>Пока пусто</Text>
        </View>
      ) : null}
    </View>
  );
}
