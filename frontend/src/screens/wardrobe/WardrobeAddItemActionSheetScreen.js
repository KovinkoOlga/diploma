import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../theme/ThemeProvider";
import { Routes } from "../../navigation/routes";
import { WARDROBE_PHOTO_MODES, openWardrobePhotoFlow } from "../../utils/wardrobePhotoFlow";

function OptionRow({ icon, title, onPress }) {
  const { colors, typography, spacing, radius } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.82 : 1 }]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          backgroundColor: colors.secondaryBackground,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={20} color={colors.text} />
        </View>
        <View style={{ marginLeft: spacing.sm, flex: 1 }}>
          <Text style={[typography.cardTitle, { color: colors.text }]}>{title}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
      </View>
    </Pressable>
  );
}

export default function WardrobeAddItemActionSheetScreen({ navigation, route }) {
  const { colors, spacing, radius } = useAppTheme();
  const catalogId = route.params?.catalogId;

  return (
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,17,17,0.34)" }}>
      <Pressable style={{ flex: 1 }} onPress={() => navigation.goBack()} />
      <View
        style={{
          backgroundColor: colors.background,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <OptionRow
          icon="camera-outline"
          title="Сфотографировать вещь"
          onPress={() => openWardrobePhotoFlow({ navigation, mode: WARDROBE_PHOTO_MODES.camera, catalogId, replace: true })}
        />
        <OptionRow
          icon="image-outline"
          title="Загрузить из галереи"
          onPress={() => openWardrobePhotoFlow({ navigation, mode: WARDROBE_PHOTO_MODES.gallery, catalogId, replace: true })}
        />
        <OptionRow
          icon="grid-outline"
          title="Выбрать из базового каталога"
          onPress={() => navigation.replace(Routes.WardrobeAddFromCatalog, catalogId ? { catalogId } : undefined)}
        />
      </View>
    </View>
  );
}
