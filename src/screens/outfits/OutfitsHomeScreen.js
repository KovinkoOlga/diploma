import React, { useMemo } from "react";
import { FlatList, View } from "react-native";
import Screen from "../../components/Screen";
import SectionHeader from "../../components/SectionHeader";
import PrimaryButton from "../../components/PrimaryButton";
import OutfitCard from "../../components/OutfitCard";
import EmptyState from "../../components/EmptyState";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";

export default function OutfitsHomeScreen({ navigation }) {
  const { spacing } = useAppTheme();
  const { outfits, items } = useWardrobe();

  const byId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  return (
    <Screen>
      <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <PrimaryButton
          title="Создать образ"
          icon="add-outline"
          onPress={() => navigation.navigate(Routes.OutfitEditor, { mode: "create" })}
        />

        <SectionHeader title={`Мои образы · ${outfits.length}`} />
        {outfits.length === 0 ? (
          <EmptyState
            icon="sparkles-outline"
            title="Пока нет образов"
            subtitle="Создайте первый образ из вещей вашего шкафа."
          />
        ) : (
          <FlatList
            data={outfits}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: 160 }}
            renderItem={({ item }) => (
              <OutfitCard
                outfit={item}
                items={item.itemIds.map((id) => byId[id]).filter(Boolean)}
                onPress={() => navigation.navigate(Routes.OutfitDetails, { outfitId: item.id })}
              />
            )}
          />
        )}
      </View>
    </Screen>
  );
}

