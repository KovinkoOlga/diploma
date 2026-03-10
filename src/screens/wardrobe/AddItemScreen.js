import React, { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Input from "../../components/Input";
import Chip from "../../components/Chip";
import ActionButton from "../../components/ActionButton";
import SectionHeader from "../../components/SectionHeader";
import { useAppTheme } from "../../theme/ThemeProvider";
import { categories } from "../../data/categories";
import { useWardrobe } from "../../store/WardrobeStore";
import { toISODate } from "../../utils/formatDate";

const colorOptions = ["белый", "черный", "серый", "бежевый", "синий", "графит", "зеленый", "розовый"];
const seasonOptions = ["весна", "лето", "осень", "зима"];
const tagOptions = ["casual", "office", "sport", "classic", "warm", "evening"];
const placeholderImage = require("../../../assets/icon.png");

export default function AddItemScreen({ navigation, route }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { actions } = useWardrobe();
  const presetCategoryId = route.params?.presetCategoryId ?? categories[0]?.id;
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState(presetCategoryId);
  const [selectedColors, setSelectedColors] = useState(["белый"]);
  const [selectedSeasons, setSelectedSeasons] = useState(["весна"]);
  const [selectedTags, setSelectedTags] = useState(["casual"]);

  const canSave = useMemo(() => title.trim().length >= 2 && categoryId, [categoryId, title]);

  const toggle = (setter, value) => {
    setter((current) => (current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]));
  };

  const onSave = () => {
    if (!canSave) {
      Alert.alert("Заполните поля", "Нужно указать название и категорию.");
      return;
    }

    actions.addItem({
      title: title.trim(),
      brand: brand.trim() || undefined,
      categoryId,
      colors: selectedColors,
      season: selectedSeasons,
      tags: selectedTags,
      image: placeholderImage,
      lastWorn: toISODate(new Date()),
    });

    navigation.goBack();
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
        <Text style={[typography.cardTitle, { color: colors.text }]}>Фото вещи</Text>
        <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 6 }]}>
          Пока используем локальный placeholder, но слой уже готов под image picker.
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          <ActionButton label="Камера" icon="camera-outline" variant="secondary" />
          <ActionButton label="Галерея" icon="image-outline" variant="secondary" />
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Основное" />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.sm }]}>Название</Text>
        <Input value={title} onChangeText={setTitle} placeholder="Например, белая рубашка" style={{ marginTop: 6 }} />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Бренд</Text>
        <Input value={brand} onChangeText={setBrand} placeholder="Uniqlo" style={{ marginTop: 6 }} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Категория" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
          {categories.map((category) => (
            <Chip key={category.id} label={category.title} selected={categoryId === category.id} onPress={() => setCategoryId(category.id)} />
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Цвета и сезон" />
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.sm }]}>Цвета</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {colorOptions.map((color) => (
            <Chip key={color} label={color} selected={selectedColors.includes(color)} onPress={() => toggle(setSelectedColors, color)} />
          ))}
        </View>
        <Text style={[typography.meta, { color: colors.secondaryText, marginTop: spacing.md }]}>Сезон</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {seasonOptions.map((season) => (
            <Chip key={season} label={season} selected={selectedSeasons.includes(season)} onPress={() => toggle(setSelectedSeasons, season)} />
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Теги" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
          {tagOptions.map((tag) => (
            <Chip key={tag} label={tag} selected={selectedTags.includes(tag)} onPress={() => toggle(setSelectedTags, tag)} />
          ))}
        </View>
      </View>

      <ActionButton label="Сохранить вещь" icon="checkmark-outline" onPress={onSave} disabled={!canSave} style={{ marginTop: spacing.lg }} fullWidth />
    </Screen>
  );
}
