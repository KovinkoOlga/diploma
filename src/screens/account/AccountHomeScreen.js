import React, { useLayoutEffect, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../../components/Screen";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { categories } from "../../data/categories";
import { Routes } from "../../navigation/routes";

export default function AccountHomeScreen({ navigation }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const { items, outfits } = useWardrobe();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate(Routes.Settings)} style={{ padding: 6 }}>
          <Ionicons name="settings-outline" size={20} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, colors.text]);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const totalOutfits = outfits.length;
    const counts = items.reduce((acc, it) => {
      acc[it.categoryId] = (acc[it.categoryId] ?? 0) + 1;
      return acc;
    }, {});
    const topCategoryId =
      Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? categories[0]?.id;
    const topCategory = categories.find((c) => c.id === topCategoryId)?.title ?? "—";
    const mostWorn =
      items.slice().sort((a, b) => (b.wearCount ?? 0) - (a.wearCount ?? 0))[0]?.title ?? "—";
    return { totalItems, totalOutfits, topCategory, mostWorn };
  }, [items, outfits]);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
        style={{ flex: 1 }}
      >
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <Card style={{ padding: spacing.md }} variant="flat">
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radius.lg,
                  backgroundColor: colors.chipBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="person-outline" size={22} color={colors.icon} />
              </View>
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    ...typography.h3,
                  }}
                >
                  Оля
                </Text>
                <Text style={[typography.caption, { marginTop: 4, color: colors.mutedText }]}>
                  “Собираю капсулу на сезон”
                </Text>
              </View>
            </View>
          </Card>

          <SectionHeader title="Статистика" />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <StatCard label="Вещей" value={stats.totalItems} />
            <StatCard label="Образов" value={stats.totalOutfits} />
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <StatCard label="Топ-категория" value={stats.topCategory} flex={1.4} />
            <StatCard label="Чаще всего" value={stats.mostWorn} flex={1.6} />
          </View>

          <SectionHeader title="Профиль" />
          <View style={{ gap: spacing.sm }}>
            <Row icon="heart-outline" title="Мои предпочтения" subtitle="Цвета, стили, бренды (заглушка)" />
            <Row icon="flag-outline" title="Цели гардероба" subtitle="Капсула, покупки, план (заглушка)" />
            <Row
              icon="settings-outline"
              title="Настройки"
              subtitle="Тема, уведомления (заглушка)"
              onPress={() => navigation.navigate(Routes.Settings)}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatCard({ label, value, flex = 1 }) {
  const { colors, spacing, typography } = useAppTheme();
  return (
    <Card style={{ flex, padding: spacing.md }} variant="flat">
      <Text style={[typography.caption, { color: colors.mutedText, letterSpacing: 0.8, textTransform: "uppercase" }]}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 6,
          color: colors.text,
          ...typography.h3,
        }}
      >
        {String(value)}
      </Text>
    </Card>
  );
}

function Row({ icon, title, subtitle, onPress }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: onPress ? (pressed ? 0.92 : 1) : 1 }]}
      disabled={!onPress}
    >
      <Card style={{ padding: spacing.md }} variant="flat">
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: colors.card2,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={icon} size={18} color={colors.icon} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.body, { color: colors.text, fontWeight: typography.weights.medium }]}>
              {title}
            </Text>
            <Text style={[typography.caption, { marginTop: 4, color: colors.mutedText }]}>
              {subtitle}
            </Text>
          </View>
          {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.mutedText} /> : null}
        </View>
      </Card>
    </Pressable>
  );
}
