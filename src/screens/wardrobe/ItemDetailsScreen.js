import React, { useLayoutEffect, useMemo } from "react";
import { Alert, Image, ScrollView, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Card from "../../components/Card";
import Chip from "../../components/Chip";
import SectionHeader from "../../components/SectionHeader";
import PrimaryButton from "../../components/PrimaryButton";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";
import { getCategoryById } from "../../data/categories";

export default function ItemDetailsScreen({ navigation, route }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const { items, actions } = useWardrobe();

  const itemId = route.params?.itemId;
  const item = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);
  const categoryTitle = useMemo(
    () => getCategoryById(item?.categoryId)?.title ?? item?.categoryId ?? "—",
    [item?.categoryId]
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: item?.title ?? "Вещь" });
  }, [navigation, item?.title]);

  if (!item) {
    return (
      <Screen>
        <View style={{ padding: spacing.md }}>
          <Text style={{ color: colors.text }}>Вещь не найдена.</Text>
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
          <Image
            source={item.image}
            style={{
              width: "100%",
              height: 240,
              borderRadius: radius.lg,
              backgroundColor: colors.card2,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />

          <SectionHeader title="О вещи" />
          <Card style={{ padding: spacing.md }} variant="flat">
            <Text style={[typography.h2, { color: colors.text }]}>{item.title}</Text>
            <Text style={[typography.body, { marginTop: 6, color: colors.mutedText }]}>
              {item.brand ? `${item.brand} · ` : ""}категория: {categoryTitle}
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md }}>
              {item.colors.map((c) => (
                <Chip key={`c_${c}`} label={c} />
              ))}
              {item.season.map((s) => (
                <Chip key={`s_${s}`} label={s} />
              ))}
              {item.tags.map((t) => (
                <Chip key={`t_${t}`} label={t} />
              ))}
            </View>
          </Card>

          <SectionHeader title="Статистика" />
          <Card style={{ padding: spacing.md }} variant="flat">
            <Text style={[typography.body, { color: colors.text }]}>
              Надевали: <Text style={{ fontWeight: typography.weights.medium }}>{item.wearCount}</Text> раз
            </Text>
            <Text style={[typography.body, { marginTop: 6, color: colors.mutedText }]}>
              Последний раз: {item.lastWorn ?? "—"}
            </Text>
          </Card>

          <SectionHeader title="Действия" />
          <View style={{ gap: spacing.sm }}>
            <PrimaryButton
              title="Добавить в образ"
              icon="sparkles-outline"
              onPress={() =>
                navigation.navigate("OutfitsTab", { screen: Routes.OutfitEditor, params: { seedItemId: item.id } })
              }
            />
            <PrimaryButton
              title="Редактировать (заглушка)"
              icon="create-outline"
              variant="ghost"
              onPress={() => Alert.alert("Редактирование", "Можно добавить экран редактирования позже.")}
            />
            <PrimaryButton
              title="Удалить"
              icon="trash-outline"
              variant="danger"
              onPress={() => {
                Alert.alert("Удалить вещь?", "Она исчезнет из шкафа и из образов.", [
                  { text: "Отмена", style: "cancel" },
                  {
                    text: "Удалить",
                    style: "destructive",
                    onPress: () => {
                      actions.deleteItem(item.id);
                      navigation.goBack();
                    },
                  },
                ]);
              }}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
