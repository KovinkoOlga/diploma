import { Alert } from "react-native";
import { formatOutfitCount } from "./outfits";

function getAffectedOutfits(outfits = [], itemIds = []) {
  const selectedIds = new Set((itemIds ?? []).filter(Boolean));
  return outfits.filter((outfit) => (outfit.itemIds ?? []).some((itemId) => selectedIds.has(itemId)));
}

export function confirmWardrobeDelete({
  itemIds,
  outfits,
  onConfirm,
}) {
  const affectedOutfits = getAffectedOutfits(outfits, itemIds);
  const isBulk = (itemIds ?? []).length > 1;

  const primaryTitle = isBulk ? "Удалить вещи?" : "Удалить вещь?";
  const primaryMessage = isBulk
    ? "Выбранные вещи будут удалены без возможности восстановления."
    : "Вещь будет удалена без возможности восстановления.";

  const secondaryTitle = affectedOutfits.length
    ? isBulk
      ? "Среди вещей есть участники образов"
      : "Вещь участвует в образе"
    : "";
  const secondaryMessage = affectedOutfits.length
    ? isBulk
      ? `Некоторые выбранные вещи участвуют в ${formatOutfitCount(affectedOutfits.length)}. После удаления вещей связанные образы тоже будут удалены. Продолжить?`
      : `Эта вещь участвует в ${formatOutfitCount(affectedOutfits.length)}. После удаления вещи связанные образы тоже будут удалены. Продолжить?`
    : "";

  const runDelete = () => {
    if (!affectedOutfits.length) {
      onConfirm?.();
      return;
    }

    Alert.alert(secondaryTitle, secondaryMessage, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: () => onConfirm?.(),
      },
    ]);
  };

  Alert.alert(primaryTitle, primaryMessage, [
    { text: "Отмена", style: "cancel" },
    {
      text: "Удалить",
      style: "destructive",
      onPress: runDelete,
    },
  ]);
}
