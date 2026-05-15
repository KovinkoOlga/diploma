import React from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import SectionHeader from "../../components/SectionHeader";
import Chip from "../../components/Chip";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";

export default function WardrobeManageCategoriesScreen() {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { categories } = useWardrobe();

  return (
    <Screen scroll padded>
      <SectionHeader title="Подкатегории" />
      <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.sm }]}>
        Категории являются системным справочником. Новые подкатегории появляются автоматически после сохранения вещи.
      </Text>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {categories.map((category) => (
          <View
            key={category.id}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              backgroundColor: colors.secondaryBackground,
              padding: spacing.md,
            }}
          >
            <Text style={[typography.cardTitle, { color: colors.text }]}>{category.title}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
              {(category.subcategories ?? []).map((subcategory) => (
                <Chip key={subcategory} label={subcategory} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

