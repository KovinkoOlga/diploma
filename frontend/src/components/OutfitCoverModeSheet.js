import React from "react";
import { View } from "react-native";
import SheetModal from "./SheetModal";
import ActionButton from "./ActionButton";
import { useAppTheme } from "../theme/ThemeProvider";

export default function OutfitCoverModeSheet({
  visible,
  onClose,
  onSelectComposition,
  onClear,
  disabled = false,
}) {
  const { spacing } = useAppTheme();

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="Обложка образа"
      subtitle="Выберите как создать или обновить обложку"
    >
      <View style={{ gap: spacing.sm }}>
        <ActionButton
          label="Составить из карточек"
          icon="grid-outline"
          variant="secondary"
          onPress={onSelectComposition}
          disabled={disabled}
          fullWidth
        />
        <ActionButton
          label="Удалить обложку"
          icon="trash-outline"
          variant="danger"
          onPress={onClear}
          disabled={disabled}
          fullWidth
        />
      </View>
    </SheetModal>
  );
}
