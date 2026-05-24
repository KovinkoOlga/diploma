import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import AppHeader from "../../components/AppHeader";
import ActionButton from "../../components/ActionButton";
import ProfileHeader from "../../components/ProfileHeader";
import Chip from "../../components/Chip";
import OutfitCard from "../../components/OutfitCard";
import WardrobeItemCard from "../../components/WardrobeItemCard";
import EmptyState from "../../components/EmptyState";
import SectionHeader from "../../components/SectionHeader";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAuth } from "../../store/AuthStore";
import { Routes } from "../../navigation/routes";

export default function AccountHomeScreen({ navigation }) {
  const { colors, typography, spacing } = useAppTheme();
  const { items, outfits, outfitCollections } = useWardrobe();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("looks");
  const itemById = useMemo(() => Object.fromEntries(items.map((item) => [item.id, item])), [items]);
  const displayName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "Профиль";
  const handle = currentUser?.email ? `@${currentUser.email.split("@")[0]}` : "@profile";

  const stats = [
    { label: "вещей", value: items.length },
    { label: "образов", value: outfits.length },
    { label: "подборок", value: outfitCollections.length },
  ];

  return (
    <Screen
      scroll
      padded
      header={
        <AppHeader
          title={displayName}
          subtitle="личный профиль"
          right={<ActionButton icon="settings-outline" compact variant="ghost" onPress={() => navigation.navigate(Routes.Settings)} />}
        />
      }
    >
      <ProfileHeader
        name={displayName}
        handle={handle}
        avatarLabel={displayName}
        avatarSource={currentUser?.avatarUrl ? { uri: currentUser.avatarUrl } : undefined}
        stats={stats}
        onPrimaryPress={() => navigation.navigate(Routes.Settings)}
        onSecondaryPress={() => navigation.navigate("OutfitsTab")}
        secondaryLabel="Мои образы"
      />

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Контент" />
        <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.sm }}>
          <Chip label="Образы" selected={activeTab === "looks"} onPress={() => setActiveTab("looks")} />
          <Chip label="Вещи" selected={activeTab === "items"} onPress={() => setActiveTab("items")} />
          <Chip label="Подборки" selected={activeTab === "collections"} onPress={() => setActiveTab("collections")} />
        </View>
      </View>

      {activeTab === "looks" ? (
        outfits.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
            {outfits.map((outfit) => (
              <View key={outfit.id} style={{ width: "48%" }}>
                <OutfitCard
                  outfit={outfit}
                  items={outfit.itemIds.map((id) => itemById[id]).filter(Boolean)}
                  onPress={() => navigation.navigate("OutfitsTab", { screen: Routes.OutfitDetails, params: { outfitId: outfit.id } })}
                />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState icon="bookmark-outline" title="Пока ничего нет" subtitle="Сохранённые образы появятся здесь." />
        )
      ) : null}

      {activeTab === "items" ? (
        items.length ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {items.slice(0, 6).map((item) => (
              <WardrobeItemCard
                key={item.id}
                item={item}
                onPress={() => navigation.navigate("WardrobeTab", { screen: Routes.ItemDetails, params: { itemId: item.id } })}
              />
            ))}
          </View>
        ) : (
          <EmptyState icon="shirt-outline" title="Пока ничего нет" subtitle="Добавленные вещи появятся здесь." />
        )
      ) : null}

      {activeTab === "collections" ? (
        outfitCollections.length ? (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {outfitCollections.map((collection) => (
              <View key={collection.id} style={{ padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 16 }}>
                <Text style={[typography.cardTitle, { color: colors.text }]}>{collection.title}</Text>
                <Text style={[typography.body, { color: colors.secondaryText, marginTop: 4 }]}>
                  {collection.outfitCount} образов
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState icon="albums-outline" title="Подборок пока нет" subtitle="Собранные подборки образов появятся здесь." />
        )
      ) : null}
    </Screen>
  );
}
