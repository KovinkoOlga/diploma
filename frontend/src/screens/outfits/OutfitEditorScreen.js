import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Input from "../../components/Input";
import Chip from "../../components/Chip";
import SectionHeader from "../../components/SectionHeader";
import ActionButton from "../../components/ActionButton";
import MediaPreview from "../../components/MediaPreview";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";

const seasonOptions = ["весна", "лето", "осень", "зима"];
const tagOptions = ["casual", "office", "sport", "classic", "warm", "evening"];

export default function OutfitEditorScreen({ navigation, route }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { outfits, items, actions } = useWardrobe();
  const existing = useMemo(() => outfits.find((entry) => entry.id === route.params?.outfitId), [outfits, route.params?.outfitId]);
  const seedItemId = route.params?.seedItemId;
  const [title, setTitle] = useState(existing?.title ?? "Новый образ");
  const [selectedSeasons, setSelectedSeasons] = useState(existing?.season ?? ["весна"]);
  const [selectedTags, setSelectedTags] = useState(existing?.tags ?? ["casual"]);
  const [selectedItemIds, setSelectedItemIds] = useState(() => {
    const base = existing?.itemIds ?? [];
    if (seedItemId && !base.includes(seedItemId)) return [seedItemId, ...base];
    return base;
  });
  const [saving, setSaving] = useState(false);

  const selectedItems = useMemo(
    () => selectedItemIds.map((id) => items.find((item) => item.id === id)).filter(Boolean),
    [items, selectedItemIds]
  );

  const toggle = (setter, value) => {
    setter((current) => (current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]));
  };

  const toggleItem = (itemId) => {
    setSelectedItemIds((current) => (current.includes(itemId) ? current.filter((entry) => entry !== itemId) : [...current, itemId]));
  };

  const onSave = async () => {
    if (title.trim().length < 2) {
      Alert.alert("Название", "Введите название образа.");
      return;
    }

    if (selectedItemIds.length === 0) {
      Alert.alert("Вещи", "Добавьте хотя бы одну вещь в образ.");
      return;
    }

    setSaving(true);
    try {
      await actions.upsertOutfit({
        id: existing?.id,
        title: title.trim(),
        itemIds: selectedItemIds,
        tags: selectedTags,
        season: selectedSeasons,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll padded withKeyboard>
      <View
        style={{
          borderRadius: radius.xl,
          backgroundColor: colors.secondaryBackground,
          padding: spacing.md,
        }}
      >
        <Text style={[typography.cardTitle, { color: colors.text }]}>Обложка образа</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.md }}>
          {selectedItems.slice(0, 3).map((item) => (
            <MediaPreview
              key={item.id}
              source={item.image}
              placeholderScale={0.48}
              containerStyle={{
                flex: 1,
                aspectRatio: 0.82,
                borderRadius: radius.md,
                backgroundColor: colors.background,
              }}
            />
          ))}
          {selectedItems.length === 0 ? (
            <View
              style={{
                flex: 1,
                aspectRatio: 1.2,
                borderRadius: radius.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.background,
              }}
            >
              <Text style={[typography.caption, { color: colors.secondaryText }]}>Пока пусто</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Метаданные" />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.sm }]}>Название</Text>
        <Input value={title} onChangeText={setTitle} style={{ marginTop: 6 }} />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Сезон</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {seasonOptions.map((season) => (
            <Chip key={season} label={season} selected={selectedSeasons.includes(season)} onPress={() => toggle(setSelectedSeasons, season)} />
          ))}
        </View>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Теги</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {tagOptions.map((tag) => (
            <Chip key={tag} label={tag} selected={selectedTags.includes(tag)} onPress={() => toggle(setSelectedTags, tag)} />
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Выбор вещей" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
          {items.map((item) => {
            const selected = selectedItemIds.includes(item.id);

            return (
              <Pressable
                key={item.id}
                onPress={() => toggleItem(item.id)}
                style={({ pressed }) => [{ width: "48%", opacity: pressed ? 0.85 : 1 }]}
              >
                <View
                  style={{
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: selected ? colors.text : colors.divider,
                    padding: spacing.sm,
                  }}
                >
                  <MediaPreview
                    source={item.image}
                    placeholderScale={0.5}
                    containerStyle={{
                      width: "100%",
                      aspectRatio: 0.85,
                      borderRadius: radius.md,
                      backgroundColor: colors.secondaryBackground,
                    }}
                  />
                  <Text style={[typography.cardTitle, { color: colors.text, marginTop: 10 }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 4 }]} numberOfLines={1}>
                    {item.colors?.[0] ?? "цвет"}
                  </Text>
                  <ActionButton
                    label={selected ? "Убрать" : "Добавить"}
                    variant={selected ? "primary" : "secondary"}
                    onPress={() => toggleItem(item.id)}
                    style={{ marginTop: spacing.sm }}
                    fullWidth
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ActionButton
        label={saving ? "Сохраняем..." : existing ? "Сохранить изменения" : "Сохранить образ"}
        icon="checkmark-outline"
        onPress={onSave}
        disabled={saving}
        style={{ marginTop: spacing.lg }}
        fullWidth
      />
    </Screen>
  );
}
