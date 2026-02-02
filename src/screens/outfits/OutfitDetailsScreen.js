import React, { useLayoutEffect, useMemo } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Card from "../../components/Card";
import Chip from "../../components/Chip";
import SectionHeader from "../../components/SectionHeader";
import PrimaryButton from "../../components/PrimaryButton";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function OutfitDetailsScreen({ navigation, route }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const { outfits, items } = useWardrobe();
  const outfitId = route.params?.outfitId;

  const outfit = useMemo(() => outfits.find((o) => o.id === outfitId), [outfits, outfitId]);
  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const outfitItems = useMemo(
    () => (outfit ? outfit.itemIds.map((id) => itemById[id]).filter(Boolean) : []),
    [outfit, itemById]
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: outfit?.title ?? "Образ" });
  }, [navigation, outfit?.title]);

  if (!outfit) {
    return (
      <Screen>
        <View style={{ padding: spacing.md }}>
          <Text style={{ color: colors.text }}>Образ не найден.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
        style={{ flex: 1 }}
      >
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <Card style={{ padding: spacing.md }} variant="flat">
            <Text style={[typography.h2, { color: colors.text }]}>{outfit.title}</Text>
            <Text style={[typography.body, { marginTop: 8, color: colors.mutedText }]}>
              {outfit.season.join(", ")} · {outfitItems.length} вещей
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md }}>
              {outfit.tags.map((t) => (
                <Chip key={t} label={t} />
              ))}
            </View>

            <PrimaryButton
              title="Редактировать"
              icon="create-outline"
              style={{ marginTop: spacing.md }}
              onPress={() => navigation.navigate(Routes.OutfitEditor, { outfitId: outfit.id })}
            />
          </Card>

          <SectionHeader title="Вещи в образе" />
          <View style={{ gap: spacing.sm }}>
            {outfitItems.map((it) => (
              <Card key={it.id} style={{ padding: spacing.md }} variant="flat">
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Image
                    source={it.image}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.md,
                      backgroundColor: colors.card2,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  />
                  <View style={{ marginLeft: spacing.md, flex: 1 }}>
                    <Text style={[typography.body, { color: colors.text, fontWeight: typography.weights.medium }]}>
                      {it.title}
                    </Text>
                    <Text style={[typography.caption, { marginTop: 4, color: colors.mutedText }]}>
                      {it.brand ? `${it.brand} · ` : ""}
                      {it.colors?.[0] ?? "—"}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
