import React, { useLayoutEffect, useMemo, useState } from "react";
import { Alert, FlatList, Image, ScrollView, Text, TextInput, View } from "react-native";
import Screen from "../../components/Screen";
import Card from "../../components/Card";
import Chip from "../../components/Chip";
import SectionHeader from "../../components/SectionHeader";
import PrimaryButton from "../../components/PrimaryButton";
import { useAppTheme } from "../../theme/ThemeProvider";
import { categories } from "../../data/categories";
import { useWardrobe } from "../../store/WardrobeStore";

const seasonOptions = ["весна", "лето", "осень", "зима"];
const tagOptions = ["casual", "office", "sport", "classic", "warm", "evening"];

export default function OutfitEditorScreen({ navigation, route }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const { outfits, items, actions } = useWardrobe();

  const outfitId = route.params?.outfitId;
  const seedItemId = route.params?.seedItemId;

  const existing = useMemo(() => outfits.find((o) => o.id === outfitId), [outfits, outfitId]);

  const [title, setTitle] = useState(existing?.title ?? "Новый образ");
  const [seasons, setSeasons] = useState(existing?.season ?? ["весна"]);
  const [tags, setTags] = useState(existing?.tags ?? ["casual"]);
  const [selectedItemIds, setSelectedItemIds] = useState(() => {
    const base = existing?.itemIds ?? [];
    if (seedItemId && !base.includes(seedItemId)) return [seedItemId, ...base];
    return base;
  });

  useLayoutEffect(() => {
    navigation.setOptions({ title: existing ? "Редактировать" : "Создать образ" });
  }, [navigation, existing]);

  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const selectedItems = useMemo(
    () => selectedItemIds.map((id) => itemById[id]).filter(Boolean),
    [selectedItemIds, itemById]
  );

  const toggleItem = (id) => {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleMulti = (setValue, item) => {
    setValue((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };

  const onSave = () => {
    if (title.trim().length < 2) {
      Alert.alert("Название", "Введите название образа (минимум 2 символа).");
      return;
    }
    if (selectedItemIds.length === 0) {
      Alert.alert("Вещи", "Добавьте хотя бы одну вещь в образ.");
      return;
    }

    const next = {
      id: existing?.id,
      title: title.trim(),
      itemIds: selectedItemIds,
      tags,
      season: seasons,
    };

    actions.upsertOutfit(next);
    navigation.goBack();
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
        style={{ flex: 1 }}
      >
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <SectionHeader title="Полотно" />
          <Card style={{ padding: spacing.md }} variant="flat">
            <Text style={[typography.caption, { color: colors.mutedText }]}>
              Простой прототип без drag&drop: выбирайте вещи ниже.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.md }}>
              {selectedItems.slice(0, 6).map((it) => (
                <Image
                  key={it.id}
                  source={it.image}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: radius.md,
                    backgroundColor: colors.card2,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                />
              ))}
              {selectedItems.length === 0 ? (
                <View
                  style={{
                    width: "100%",
                    height: 96,
                    borderRadius: radius.md,
                    backgroundColor: colors.card2,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={[typography.caption, { color: colors.mutedText }]}>Пока пусто</Text>
                </View>
              ) : null}
            </View>
          </Card>

          <SectionHeader title="Параметры" />
          <Card style={{ padding: spacing.md }} variant="flat">
            <Text style={[typography.caption, { color: colors.mutedText, letterSpacing: 0.8, textTransform: "uppercase" }]}>
              Название
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Новый образ"
              placeholderTextColor={colors.mutedText}
              style={{
                marginTop: 6,
                height: 46,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                backgroundColor: colors.card2,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                ...typography.body,
              }}
            />

            <Text style={[typography.caption, { marginTop: spacing.md, color: colors.mutedText, letterSpacing: 0.8, textTransform: "uppercase" }]}>
              Сезон
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {seasonOptions.map((s) => (
                <Chip key={s} label={s} selected={seasons.includes(s)} onPress={() => toggleMulti(setSeasons, s)} />
              ))}
            </View>

            <Text style={[typography.caption, { marginTop: spacing.md, color: colors.mutedText, letterSpacing: 0.8, textTransform: "uppercase" }]}>
              Теги
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {tagOptions.map((t) => (
                <Chip key={t} label={t} selected={tags.includes(t)} onPress={() => toggleMulti(setTags, t)} />
              ))}
            </View>
          </Card>

          <SectionHeader title="Выбор вещей" />
          <View style={{ gap: spacing.md }}>
            {categories.map((cat) => {
              const catItems = items.filter((it) => it.categoryId === cat.id);
              if (catItems.length === 0) return null;
              return (
                <View key={cat.id}>
                  <Text style={[typography.body, { color: colors.text, fontWeight: typography.weights.medium }]}>
                    {cat.title}
                  </Text>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={catItems}
                    keyExtractor={(it) => it.id}
                    contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
                    renderItem={({ item }) => {
                      const selected = selectedItemIds.includes(item.id);
                      return (
                        <Card
                          style={{
                            padding: 10,
                            width: 120,
                            backgroundColor: selected ? colors.accentSoft : colors.card,
                            borderColor: selected ? colors.accent : colors.border,
                          }}
                        >
                          <Image
                            source={item.image}
                            style={{
                              width: "100%",
                              height: 70,
                              borderRadius: radius.md,
                              backgroundColor: colors.card2,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          />
                          <Text
                            numberOfLines={1}
                            style={{
                              marginTop: 8,
                              color: colors.text,
                              ...typography.caption,
                              fontWeight: typography.weights.medium,
                            }}
                          >
                            {item.title}
                          </Text>
                          <Text
                            style={[typography.small, { marginTop: 2, color: colors.mutedText }]}
                            numberOfLines={1}
                          >
                            {item.colors?.[0] ?? "—"}
                          </Text>
                          <PrimaryButton
                            title={selected ? "Убрать" : "Добавить"}
                            variant={selected ? "ghost" : "primary"}
                            style={{ marginTop: 8, height: 36, borderRadius: radius.md }}
                            onPress={() => toggleItem(item.id)}
                          />
                        </Card>
                      );
                    }}
                  />
                </View>
              );
            })}
          </View>

          <PrimaryButton
            title="Сохранить образ"
            icon="checkmark-outline"
            style={{ marginTop: spacing.lg }}
            onPress={onSave}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
