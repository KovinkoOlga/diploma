import React from "react";
import { Pressable, Text, View } from "react-native";
import MediaPreview from "../../../components/MediaPreview";
import { useAppTheme } from "../../../theme/ThemeProvider";

export default function HorizontalOutfitStatsCard({ outfit, imageSource, subtitle, meta, onPress }) {
  const { colors, typography, spacing, radius } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: 170, opacity: pressed ? 0.84 : 1 }]}>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          backgroundColor: colors.background,
          padding: spacing.sm,
        }}
      >
        <MediaPreview
          source={imageSource}
          containerStyle={{
            width: "100%",
            aspectRatio: 1.02,
            borderRadius: radius.md,
            backgroundColor: colors.secondaryBackground,
          }}
          placeholderScale={0.44}
        />
        <Text style={[typography.cardTitle, { color: colors.text, marginTop: spacing.sm }]} numberOfLines={1}>
          {outfit?.title}
        </Text>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 4 }]} numberOfLines={1}>
          {subtitle}
        </Text>
        <Text
          style={[
            typography.caption,
            {
              color: colors.text,
              marginTop: spacing.sm,
              fontVariant: ["tabular-nums"],
            },
          ]}
        >
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}
