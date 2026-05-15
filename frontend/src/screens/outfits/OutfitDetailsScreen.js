import React, { useLayoutEffect, useMemo } from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import Chip from "../../components/Chip";
import SectionHeader from "../../components/SectionHeader";
import WardrobeItemCard from "../../components/WardrobeItemCard";
import ActionButton from "../../components/ActionButton";
import EmptyState from "../../components/EmptyState";
import MediaPreview from "../../components/MediaPreview";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function OutfitDetailsScreen({ navigation, route }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { outfits, items } = useWardrobe();
  const outfit = useMemo(() => outfits.find((entry) => entry.id === route.params?.outfitId), [outfits, route.params?.outfitId]);
  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const outfitItems = useMemo(() => (outfit?.itemIds ?? []).map((id) => itemById[id]).filter(Boolean), [itemById, outfit?.itemIds]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: outfit?.title ?? "Образ" });
  }, [navigation, outfit?.title]);

  if (!outfit) {
    return (
      <Screen padded>
        <EmptyState icon="alert-circle-outline" title="Образ не найден" subtitle="Вернитесь к сетке образов и выберите другой." />
      </Screen>
    );
  }

  return (
    <Screen scroll padded>
      <MediaPreview
        source={outfitItems[0]?.image}
        placeholderScale={0.46}
        containerStyle={{
          width: "100%",
          aspectRatio: 1.05,
          borderRadius: radius.xl,
          backgroundColor: colors.secondaryBackground,
        }}
      />

      <View style={{ marginTop: spacing.md }}>
        <Text style={[typography.h1, { color: colors.text }]}>{outfit.title}</Text>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: 6 }]}>
          {outfit.season.join(", ")} · {outfitItems.length} вещей
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md }}>
        {(outfit.tags ?? []).map((tag) => (
          <Chip key={tag} label={tag} />
        ))}
      </View>

      <ActionButton
        label="Редактировать образ"
        icon="create-outline"
        variant="secondary"
        onPress={() => navigation.navigate(Routes.OutfitEditor, { outfitId: outfit.id })}
        style={{ marginTop: spacing.md }}
        fullWidth
      />

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Состав" />
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          {outfitItems.map((item) => (
            <WardrobeItemCard
              key={item.id}
              item={item}
              variant="list"
              onPress={() => navigation.navigate("WardrobeTab", { screen: Routes.ItemDetails, params: { itemId: item.id } })}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}
