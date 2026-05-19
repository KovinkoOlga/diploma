import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import CategoryIcon from "./CategoryIcon";

export default function CategoryTile({ title, icon, count, tone = "blue", onPress }) {
  const { colors, spacing, typography, radius } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
      <View
        style={[
          styles.tile,
          {
            backgroundColor: colors.card,
            borderColor: colors.divider,
            borderRadius: radius.md,
            padding: spacing.md,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Text style={[typography.sectionTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[typography.caption, { marginTop: 2, color: colors.mutedText }]}>{count} вещей</Text>
          </View>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: colors.bg2 ?? colors.card2, borderColor: colors.border, borderRadius: radius.pill },
            ]}
          >
            <CategoryIcon icon={icon} size={16} color={colors.mutedText} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
