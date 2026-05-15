import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../../components/Screen";
import AppHeader from "../../components/AppHeader";
import ActionButton from "../../components/ActionButton";
import FeedCard from "../../components/FeedCard";
import SectionHeader from "../../components/SectionHeader";
import Chip from "../../components/Chip";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function HomeScreen({ navigation }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { outfits, items, feedPosts, homeContent } = useWardrobe();

  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const suggestedOutfit = outfits[0];
  const featuredPost = feedPosts[0];
  const secondaryPost = feedPosts[1];
  const weather = homeContent?.weather ?? {};
  const quickMoments = homeContent?.quickMoments ?? [];
  const tip = homeContent?.tips?.[1] ?? "";

  const featuredImage = suggestedOutfit?.itemIds?.[0] ? itemById[suggestedOutfit.itemIds[0]]?.image : items[0]?.image;
  const secondaryImage = secondaryPost?.outfitId
    ? itemById[outfits.find((outfit) => outfit.id === secondaryPost.outfitId)?.itemIds?.[0]]?.image
    : items[1]?.image;

  return (
    <Screen
      scroll
      padded
      header={
        <AppHeader
          title="lookbook"
          subtitle="для гардероба и образов"
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <ActionButton icon="heart-outline" compact variant="ghost" onPress={() => navigation.navigate("NewsTab")} />
              <ActionButton icon="paper-plane-outline" compact variant="ghost" onPress={() => navigation.navigate("AccountTab")} />
            </View>
          }
        />
      }
    >
      <View>
        <Text style={[typography.screenTitle, { color: colors.text }]}>Сегодняшний ритм</Text>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: 6 }]}>
          {weather.city ?? "Город"} · {weather.temperatureC ?? "—"}° · {weather.condition ?? "Погода обновляется"}
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md }}>
        {quickMoments.map((moment) => (
          <View
            key={moment.id}
            style={{
              minWidth: "48%",
              flex: 1,
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: colors.secondaryBackground,
            }}
          >
            <Text style={[typography.cardTitle, { color: colors.text }]}>{moment.title}</Text>
            <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 4 }]}>{moment.subtitle}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Быстрые действия" />
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          <ActionButton
            label="Добавить вещь"
            icon="add-outline"
            variant="primary"
            onPress={() => navigation.navigate("WardrobeTab", { screen: Routes.AddItem })}
            style={{ flex: 1 }}
            fullWidth
          />
          <ActionButton
            label="Собрать образ"
            icon="sparkles-outline"
            variant="secondary"
            onPress={() => navigation.navigate("OutfitsTab", { screen: Routes.OutfitEditor })}
            style={{ flex: 1 }}
            fullWidth
          />
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Рекомендация на сегодня" actionLabel="Открыть шкаф" onAction={() => navigation.navigate("WardrobeTab")} />
        <View style={{ marginTop: spacing.sm }}>
          <FeedCard
            eyebrow="Персональная подборка"
            title={suggestedOutfit?.title ?? "Новый образ"}
            summary={tip}
            meta={`${suggestedOutfit?.itemIds?.length ?? 0} вещей · ${(suggestedOutfit?.tags ?? []).join(", ")}`}
            image={featuredImage}
            actionLabel="Смотреть"
            onPress={() =>
              suggestedOutfit
                ? navigation.navigate("OutfitsTab", {
                    screen: Routes.OutfitDetails,
                    params: { outfitId: suggestedOutfit.id },
                  })
                : null
            }
            onActionPress={() =>
              suggestedOutfit
                ? navigation.navigate("OutfitsTab", {
                    screen: Routes.OutfitDetails,
                    params: { outfitId: suggestedOutfit.id },
                  })
                : null
            }
          />
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Сейчас в ленте" actionLabel="Все новости" onAction={() => navigation.navigate("NewsTab")} />
        <View style={{ marginTop: spacing.sm, gap: spacing.md }}>
          {[featuredPost, secondaryPost].filter(Boolean).map((post) => (
            <FeedCard
              key={post.id}
              eyebrow={`${post.category} · ${post.timeAgo}`}
              title={post.title}
              summary={post.text}
              meta={`${post.likes} лайков · ${post.source}`}
              image={post.id === featuredPost.id ? featuredImage : secondaryImage}
              actionLabel="Читать"
              onPress={() =>
                navigation.navigate("NewsTab", {
                  screen: Routes.PostDetails,
                  params: { postId: post.id },
                })
              }
              onActionPress={() =>
                navigation.navigate("NewsTab", {
                  screen: Routes.PostDetails,
                  params: { postId: post.id },
                })
              }
            />
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Подходит под погоду" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
          {["слойность", "пальто", "нейтральная база", "комфортная обувь"].map((label) => (
            <Chip key={label} label={label} />
          ))}
        </View>
        <View
          style={{
            marginTop: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.secondaryBackground,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ionicons name="cloud-outline" size={20} color={colors.text} />
          <Text style={[typography.body, { color: colors.text, marginLeft: 10, flex: 1 }]}>
            Температура ощущается как {weather.feelsLikeC ?? "—"}°. Лучше оставить один внешний слой и мягкую обувь.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
