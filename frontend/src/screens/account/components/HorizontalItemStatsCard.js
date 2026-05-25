import React from "react";
import { Pressable, Text, View } from "react-native";
import MediaPreview from "../../../components/MediaPreview";
import { useAppTheme } from "../../../theme/ThemeProvider";

export default function HorizontalItemStatsCard({ item, subtitle, meta, onPress }) {
  const { colors, typography, spacing, radius } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: 150, opacity: pressed ? 0.84 : 1 }]}>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          backgroundColor: colors.secondaryBackground,
          padding: spacing.sm,
        }}
      >
        <MediaPreview
          source={item?.image}
          containerStyle={{
            width: "100%",
            aspectRatio: 0.9,
            borderRadius: radius.md,
            backgroundColor: colors.background,
          }}
          placeholderScale={0.46}
        />
        <Text style={[typography.cardTitle, { color: colors.text, marginTop: spacing.sm }]} numberOfLines={1}>
          {item?.title}
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
