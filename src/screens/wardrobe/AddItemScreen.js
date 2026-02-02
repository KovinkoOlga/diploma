import React, { useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../../components/Screen";
import Card from "../../components/Card";
import Chip from "../../components/Chip";
import SectionHeader from "../../components/SectionHeader";
import PrimaryButton from "../../components/PrimaryButton";
import { useAppTheme } from "../../theme/ThemeProvider";
import { categories } from "../../data/categories";
import { useWardrobe } from "../../store/WardrobeStore";
import { toISODate } from "../../utils/formatDate";

const colorOptions = ["белый", "черный", "серый", "бежевый", "синий", "графит", "зелёный", "розовый"];
const seasonOptions = ["весна", "лето", "осень", "зима"];
const tagOptions = ["casual", "office", "sport", "classic", "warm", "evening"];

const placeholderImage = require("../../../assets/icon.png");

export default function AddItemScreen({ navigation, route }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const { actions } = useWardrobe();

  const presetCategoryId = route.params?.presetCategoryId;

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState(presetCategoryId ?? categories[0]?.id);
  const [colorsValue, setColorsValue] = useState(["белый"]);
  const [seasons, setSeasons] = useState(["весна"]);
  const [tags, setTags] = useState(["casual"]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Добавить вещь" });
  }, [navigation]);

  const canSave = useMemo(() => title.trim().length >= 2 && categoryId, [title, categoryId]);

  const toggleMulti = (setValue, item) => {
    setValue((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };

  const onSave = () => {
    if (!canSave) {
      Alert.alert("Заполните поля", "Минимум: название и категория.");
      return;
    }

    actions.addItem({
      title: title.trim(),
      brand: brand.trim() || undefined,
      categoryId,
      colors: colorsValue.length ? colorsValue : ["—"],
      season: seasons.length ? seasons : ["—"],
      tags,
      image: placeholderImage,
      lastWorn: toISODate(new Date()),
    });

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
          <SectionHeader title="Фото" />
          <Card style={{ padding: spacing.md }}>
            <Text style={[typography.caption, { color: colors.mutedText }]}>
              Заглушка UI (подготовка под expo-image-picker)
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <ActionTile
                title="Камера"
                icon="camera-outline"
                onPress={() => Alert.alert("Камера", "Заглушка. Позже подключим expo-image-picker.")}
              />
              <ActionTile
                title="Галерея"
                icon="image-outline"
                onPress={() => Alert.alert("Галерея", "Заглушка. Позже подключим expo-image-picker.")}
              />
              <ActionTile
                title="Каталог"
                icon="grid-outline"
                onPress={() => Alert.alert("Каталог", "Заглушка. Здесь могут быть шаблоны вещей.")}
              />
            </View>
          </Card>

          <SectionHeader title="Основное" />
          <Card style={{ padding: spacing.md }}>
            <FieldLabel label="Название" />
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Например, Белая рубашка"
              placeholderTextColor={colors.mutedText}
              style={inputStyle({ colors, radius, spacing, typography })}
            />

            <FieldLabel label="Бренд (опционально)" style={{ marginTop: spacing.md }} />
            <TextInput
              value={brand}
              onChangeText={setBrand}
              placeholder="Uniqlo"
              placeholderTextColor={colors.mutedText}
              style={inputStyle({ colors, radius, spacing, typography })}
            />

            <FieldLabel label="Категория" style={{ marginTop: spacing.md }} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {categories.map((c) => (
                <Chip key={c.id} label={c.title} selected={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
              ))}
            </View>
          </Card>

          <SectionHeader title="Атрибуты" />
          <Card style={{ padding: spacing.md }}>
            <FieldLabel label="Цвета" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {colorOptions.map((c) => (
                <Chip key={c} label={c} selected={colorsValue.includes(c)} onPress={() => toggleMulti(setColorsValue, c)} />
              ))}
            </View>

            <FieldLabel label="Сезон" style={{ marginTop: spacing.md }} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {seasonOptions.map((s) => (
                <Chip key={s} label={s} selected={seasons.includes(s)} onPress={() => toggleMulti(setSeasons, s)} />
              ))}
            </View>

            <FieldLabel label="Теги / стиль" style={{ marginTop: spacing.md }} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {tagOptions.map((t) => (
                <Chip key={t} label={t} selected={tags.includes(t)} onPress={() => toggleMulti(setTags, t)} />
              ))}
            </View>
          </Card>

          <PrimaryButton
            title="Сохранить"
            icon="checkmark-outline"
            disabled={!canSave}
            style={{ marginTop: spacing.lg }}
            onPress={onSave}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function inputStyle({ colors, radius, spacing, typography }) {
  return {
    marginTop: 6,
    height: 46,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    ...typography.body,
  };
}

function FieldLabel({ label, style }) {
  const { colors, typography } = useAppTheme();
  return (
    <Text style={[typography.caption, { color: colors.mutedText, letterSpacing: 0.8, textTransform: "uppercase" }, style]}>
      {label}
    </Text>
  );
}

function ActionTile({ title, icon, onPress }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          height: 84,
          borderRadius: radius.md,
          backgroundColor: colors.card2,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.icon} />
      <Text style={[typography.small, { marginTop: spacing.xs, color: colors.mutedText }]}>
        {title}
      </Text>
    </Pressable>
  );
}
