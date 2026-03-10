import React, { useLayoutEffect, useMemo } from "react";
import { Alert, Text, View } from "react-native";
import Screen from "../../components/Screen";
import SectionHeader from "../../components/SectionHeader";
import Chip from "../../components/Chip";
import ActionButton from "../../components/ActionButton";
import ListRow from "../../components/ListRow";
import EmptyState from "../../components/EmptyState";
import MediaPreview from "../../components/MediaPreview";
import { useAppTheme } from "../../theme/ThemeProvider";
import { getCategoryById } from "../../data/categories";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function ItemDetailsScreen({ navigation, route }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { items, actions } = useWardrobe();
  const item = useMemo(() => items.find((entry) => entry.id === route.params?.itemId), [items, route.params?.itemId]);
  const category = getCategoryById(item?.categoryId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: item?.title ?? "Вещь" });
  }, [item?.title, navigation]);

  if (!item) {
    return (
      <Screen padded>
        <EmptyState icon="alert-circle-outline" title="Вещь не найдена" subtitle="Попробуйте открыть другой элемент из шкафа." />
      </Screen>
    );
  }

  return (
    <Screen scroll padded>
      <MediaPreview
        source={item.image}
        placeholderScale={0.48}
        containerStyle={{
          width: "100%",
          aspectRatio: 0.92,
          borderRadius: radius.xl,
          backgroundColor: colors.secondaryBackground,
        }}
      />

      <View style={{ marginTop: spacing.md }}>
        <Text style={[typography.h1, { color: colors.text }]}>{item.title}</Text>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: 6 }]}>
          {[item.brand, category?.title].filter(Boolean).join(" · ")}
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md }}>
        {[...(item.colors ?? []), ...(item.season ?? []), ...(item.tags ?? [])].map((entry) => (
          <Chip key={entry} label={entry} />
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
        <ActionButton
          label="В образ"
          icon="sparkles-outline"
          onPress={() => navigation.navigate("OutfitsTab", { screen: Routes.OutfitEditor, params: { seedItemId: item.id } })}
          style={{ flex: 1 }}
          fullWidth
        />
        <ActionButton
          label="Удалить"
          icon="trash-outline"
          variant="danger"
          onPress={() =>
            Alert.alert("Удалить вещь?", "Она пропадет из шкафа и из связанных образов.", [
              { text: "Отмена", style: "cancel" },
              {
                text: "Удалить",
                style: "destructive",
                onPress: () => {
                  actions.deleteItem(item.id);
                  navigation.goBack();
                },
              },
            ])
          }
          style={{ flex: 1 }}
          fullWidth
        />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Детали" />
        <View style={{ marginTop: spacing.xs }}>
          <ListRow title="Бренд" value={item.brand ?? "Не указан"} />
          <ListRow title="Категория" value={category?.title ?? "Без категории"} />
          <ListRow title="Надевали" value={`${item.wearCount} раз`} />
          <ListRow title="Последний выход" value={item.lastWorn ?? "Не отмечен"} />
        </View>
      </View>
    </Screen>
  );
}
