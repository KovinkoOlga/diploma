import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import Card from "./Card";
import Chip from "./Chip";
import { useAppTheme } from "../theme/ThemeProvider";

export default function OutfitCard({ outfit, items, onPress }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const preview = items.slice(0, 3);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}>
      <Card style={{ padding: spacing.md }} variant="flat">
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flexDirection: "row" }}>
            {preview.map((it, idx) => (
              <Image
                key={it.id}
                source={it.image}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.sm,
                  marginLeft: idx === 0 ? 0 : -10,
                  backgroundColor: colors.card2,
                  borderWidth: 2,
                  borderColor: colors.surface,
                }}
              />
            ))}
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text
              style={[typography.body, { color: colors.text, fontWeight: typography.weights.medium }]}
              numberOfLines={1}
            >
              {outfit.title}
            </Text>
            <Text style={[typography.caption, { marginTop: 2, color: colors.mutedText }]}>
              {outfit.season?.join(", ") ?? "—"} · {outfit.itemIds.length} вещей
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
              {(outfit.tags ?? []).slice(0, 3).map((t) => (
                <Chip key={t} label={t} />
              ))}
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
