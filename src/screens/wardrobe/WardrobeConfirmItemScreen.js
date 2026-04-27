import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import ActionButton from "../../components/ActionButton";
import WardrobeItemForm from "../../components/WardrobeItemForm";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";
import { createDraftFromItem, normalizeWardrobeItemDraft } from "../../utils/wardrobe";

export default function WardrobeConfirmItemScreen({ navigation, route }) {
  const { typography, colors, spacing } = useAppTheme();
  const { catalogs, categories, items, actions } = useWardrobe();
  const existingItem = useMemo(() => items.find((item) => item.id === route.params?.itemId), [items, route.params?.itemId]);
  const isEditMode = Boolean(existingItem);
  const [draft, setDraft] = useState(
    normalizeWardrobeItemDraft(route.params?.draft ?? createDraftFromItem(existingItem ?? {}), existingItem)
  );

  const saveDraft = () => {
    if (existingItem) {
      const updated = actions.updateItem(existingItem.id, draft);
      return updated ?? { ...existingItem, ...draft };
    }

    return actions.addItem(draft);
  };

  return (
    <Screen scroll padded withKeyboard>
      <Text style={[typography.h2, { color: colors.text }]}>
        {isEditMode ? "Редактирование вещи" : "Подтвердите карточку вещи"}
      </Text>
      <Text style={[typography.body, { color: colors.secondaryText, marginTop: 8 }]}>
        {isEditMode
          ? "Изменения вносятся прямо на этом экране без отдельного шага редактирования."
          : "Моковые атрибуты уже подставлены. Их можно сразу скорректировать на этом экране и сохранить в шкаф."}
      </Text>

      <View style={{ marginTop: spacing.lg }}>
        <WardrobeItemForm draft={draft} onChange={setDraft} catalogs={catalogs} categories={categories} />
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <ActionButton
          label="Сохранить"
          icon="checkmark-outline"
          onPress={() => {
            const saved = saveDraft();

            if (isEditMode) {
              navigation.goBack();
              return;
            }

            navigation.reset({
              index: 1,
              routes: [
                { name: Routes.WardrobeHome },
                { name: Routes.ItemDetails, params: { itemId: saved.id } },
              ],
            });
          }}
          fullWidth
        />
        <ActionButton
          label="Отменить"
          icon="close-outline"
          variant="secondary"
          onPress={() => navigation.goBack()}
          fullWidth
        />
      </View>
    </Screen>
  );
}
