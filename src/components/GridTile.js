import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import MediaPreview from "./MediaPreview";

export default function GridTile({ image, title, subtitle, badge, onPress }) {
  const { colors, typography, radius, spacing } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.9 : 1 }]}>
      <View>
        <MediaPreview source={image} containerStyle={[styles.image, { backgroundColor: colors.secondaryBackground, borderRadius: radius.lg }]} />
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.overlay, borderRadius: radius.pill }]}>
            <Text style={[typography.meta, { color: colors.text }]}>{badge}</Text>
          </View>
        ) : null}
        <Text style={[typography.cardTitle, { color: colors.text, marginTop: spacing.sm }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 3 }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    aspectRatio: 0.92,
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
