import React, { useCallback, useLayoutEffect, useMemo } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Chip from "../../components/Chip";
import SectionHeader from "../../components/SectionHeader";
import ActionButton from "../../components/ActionButton";
import EmptyState from "../../components/EmptyState";
import MediaPreview from "../../components/MediaPreview";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";
import { formatOutfitItemCount } from "../../utils/outfits";

function OutfitItemGridCard({ item, categoryTitle, onPress }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const subtitle = [categoryTitle, item?.subcategory].filter(Boolean).join(" · ") || item?.brand || "Вещь";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: "48.5%", opacity: pressed ? 0.88 : 1 }]}>
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
          placeholderScale={0.44}
          containerStyle={{
            width: "100%",
            aspectRatio: 0.92,
            borderRadius: radius.md,
            backgroundColor: colors.background,
          }}
        />
        <Text style={[typography.cardTitle, { color: colors.text, marginTop: spacing.sm }]} numberOfLines={1}>
          {item?.title}
        </Text>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 4 }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export default function OutfitDetailsScreen({ navigation, route }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { outfits, items, categories, actions } = useWardrobe();
  const outfit = useMemo(
    () => outfits.find((entry) => entry.id === route.params?.outfitId),
    [outfits, route.params?.outfitId]
  );
  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const categoriesById = useMemo(
    () => Object.fromEntries(categories.map((entry) => [entry.id, entry])),
    [categories]
  );
  const outfitItems = useMemo(
    () => (outfit?.itemIds ?? []).map((id) => itemById[id]).filter(Boolean),
    [itemById, outfit?.itemIds]
  );
  const safeBackToOutfits = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate(Routes.OutfitsHome);
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: outfit?.title ?? "Образ",
    });
  }, [navigation, outfit?.title]);

  if (!outfit) {
    return (
      <Screen padded>
        <EmptyState
          icon="alert-circle-outline"
          title="Образ не найден"
          subtitle="Вернитесь к сетке образов и выберите другой."
        />
      </Screen>
    );
  }

  const onDelete = () => {
    Alert.alert("Удалить образ?", "Образ будет удалён, но вещи останутся в шкафу.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          await actions.deleteOutfit(outfit.id);
          safeBackToOutfits();
        },
      },
    ]);
  };

  return (
    <Screen scroll padded>
      <MediaPreview
        source={outfit.coverTransparentImage ?? outfit.coverImage ?? outfitItems[0]?.image}
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
          {(outfit.season ?? []).join(", ") || "Сезон не указан"} · {formatOutfitItemCount(outfitItems.length)}
        </Text>
        {outfit.description ? (
          <Text style={[typography.body, { color: colors.text, marginTop: spacing.sm }]}>
            {outfit.description}
          </Text>
        ) : null}
        {outfit.createdAt ? (
          <Text style={[typography.caption, { color: colors.secondaryText, marginTop: spacing.xs }]}>
            Создан: {new Date(outfit.createdAt).toLocaleDateString("ru-RU")}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md }}>
        {(outfit.tags ?? []).map((tag) => (
          <Chip key={tag} label={tag} />
        ))}
        {(outfit.collections ?? []).map((collection) => (
          <Chip key={collection.id} label={collection.title} />
        ))}
      </View>

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <ActionButton
          label="Редактировать образ"
          icon="create-outline"
          variant="secondary"
          onPress={() => navigation.navigate(Routes.OutfitEditor, { outfitId: outfit.id })}
          fullWidth
        />
        <ActionButton
          label="Удалить образ"
          icon="trash-outline"
          variant="danger"
          onPress={onDelete}
          fullWidth
        />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Состав" />
        {outfitItems.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
            {outfitItems.map((item) => (
              <OutfitItemGridCard
                key={item.id}
                item={item}
                categoryTitle={categoriesById[item.categoryId]?.title}
                onPress={() =>
                  navigation.navigate("WardrobeTab", {
                    screen: Routes.WardrobeItemDetails,
                    params: { itemId: item.id },
                  })
                }
              />
            ))}
          </View>
        ) : (
          <View
            style={{
              marginTop: spacing.sm,
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: colors.secondaryBackground,
            }}
          >
            <Text style={[typography.body, { color: colors.secondaryText }]}>
              В составе этого образа пока нет вещей.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}
