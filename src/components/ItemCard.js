import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import Card from "./Card";
import Chip from "./Chip";
import { useAppTheme } from "../theme/ThemeProvider";

export default function ItemCard({ item, onPress }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}>
      <Card style={{ padding: spacing.md }} variant="flat">
        <View style={{ flexDirection: "row" }}>
          <Image
            source={item.image}
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.md,
              backgroundColor: colors.card2,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text
              style={[typography.body, { color: colors.text, fontWeight: typography.weights.medium }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={[typography.caption, { marginTop: 2, color: colors.mutedText }]}>
              {item.brand ? `${item.brand} · ` : ""}
              {item.colors?.[0] ?? "—"} · {item.season?.join(", ") ?? "—"}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
              {(item.tags ?? []).slice(0, 3).map((t) => (
                <Chip key={t} label={t} />
              ))}
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
