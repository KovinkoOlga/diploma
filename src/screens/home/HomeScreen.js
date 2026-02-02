import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../../components/Screen";
import WeatherWidget from "../../components/WeatherWidget";
import CalendarStrip from "../../components/CalendarStrip";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import PrimaryButton from "../../components/PrimaryButton";
import { useAppTheme } from "../../theme/ThemeProvider";
import { formatLongRuDate, toISODate } from "../../utils/formatDate";
import { homeTips, homeWeatherMock } from "../../data/home";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function HomeScreen({ navigation }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const { outfits } = useWardrobe();

  const [selectedDayKey, setSelectedDayKey] = useState(toISODate(new Date()));

  const greetingName = "Оля";
  const dateLine = useMemo(() => {
    const d = formatLongRuDate(new Date());
    return d.charAt(0).toUpperCase() + d.slice(1);
  }, []);

  const tip = useMemo(() => homeTips[Math.floor(Math.random() * homeTips.length)], []);
  const suggestedOutfit = outfits[0];

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        style={{ flex: 1 }}
      >
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
          <Text
            style={[
              typography.caption,
              { color: colors.mutedText, letterSpacing: 0.9, textTransform: "uppercase" },
            ]}
          >
            Доброе утро, {greetingName}
          </Text>
          <Text
            style={[typography.h1, { marginTop: spacing.xs, color: colors.text }]}
          >
            {dateLine}
          </Text>
        </View>

        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.lg }}>
          <WeatherWidget weather={homeWeatherMock} />
        </View>

        <View style={{ paddingHorizontal: spacing.md }}>
          <SectionHeader title="Ближайшие дни" />
        </View>
        <CalendarStrip selectedKey={selectedDayKey} onSelect={setSelectedDayKey} />

        <View style={{ paddingHorizontal: spacing.md }}>
          <SectionHeader title="Совет на сегодня" />
          <Card style={{ padding: spacing.md }} variant="flat">
            <Text style={[typography.body, { color: colors.text }]}>{tip}</Text>
            <View
              style={{
                marginTop: spacing.md,
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.card2,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={[typography.h3, { color: colors.text }]}
              >
                Подходит: {suggestedOutfit?.title ?? "—"}
              </Text>
              <Text style={[typography.caption, { marginTop: 4, color: colors.mutedText }]}>
                {suggestedOutfit ? `${suggestedOutfit.itemIds.length} вещей · ${suggestedOutfit.tags.join(", ")}` : ""}
              </Text>
              <PrimaryButton
                title="Открыть образ"
                icon="open-outline"
                disabled={!suggestedOutfit}
                style={{ marginTop: spacing.md }}
                onPress={() => {
                  if (!suggestedOutfit) return;
                  navigation.navigate("OutfitsTab", {
                    screen: Routes.OutfitDetails,
                    params: { outfitId: suggestedOutfit.id },
                  });
                }}
              />
            </View>
          </Card>
        </View>

        <View style={{ paddingHorizontal: spacing.md }}>
          <SectionHeader title="Быстрые действия" />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <QuickAction
              title="Добавить вещь"
              icon="add-circle-outline"
              onPress={() =>
                navigation.navigate("WardrobeTab", { screen: Routes.AddItem, params: { from: "home" } })
              }
            />
            <QuickAction
              title="Создать образ"
              icon="sparkles-outline"
              onPress={() =>
                navigation.navigate("OutfitsTab", { screen: Routes.OutfitEditor, params: { mode: "create" } })
              }
            />
            <QuickAction
              title="Сканировать"
              icon="scan-outline"
              onPress={() => Alert.alert("Сканирование", "Заглушка UI: подключим expo-image-picker позже.")}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function QuickAction({ title, icon, onPress }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.icon} />
      <Text
        style={[
          typography.caption,
          { marginTop: spacing.sm, color: colors.text, fontWeight: typography.weights.medium },
        ]}
        numberOfLines={2}
      >
        {title}
      </Text>
    </Pressable>
  );
}
