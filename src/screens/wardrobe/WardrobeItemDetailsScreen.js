import React, { useLayoutEffect, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import Screen from "../../components/Screen";
import ActionButton from "../../components/ActionButton";
import EmptyState from "../../components/EmptyState";
import MediaPreview from "../../components/MediaPreview";
import SectionHeader from "../../components/SectionHeader";
import Chip from "../../components/Chip";
import SheetModal from "../../components/SheetModal";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";
import { Routes } from "../../navigation/routes";
import { getStatusMeta } from "../../utils/wardrobe";

function InfoTable({ rows }) {
  const { colors, typography, spacing, radius } = useAppTheme();

  return (
    <View
      style={{
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        overflow: "hidden",
        backgroundColor: colors.secondaryBackground,
      }}
    >
      {rows.map((row, index) => (
        <View
          key={row.label}
          style={{
            flexDirection: "row",
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: colors.border,
            minHeight: 40,
          }}
        >
          <View
            style={{
              width: "38%",
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs + 2,
              borderRightWidth: 1,
              borderRightColor: colors.border,
              backgroundColor: colors.background,
              justifyContent: "center",
            }}
          >
            <Text style={[typography.meta, { color: colors.text, fontWeight: "600", fontSize: 12.5 }]}>{row.label}</Text>
          </View>
          <View style={{ flex: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 2, justifyContent: "center" }}>
            <Text style={[typography.body, { color: colors.text, fontSize: 14, lineHeight: 18 }]}>{row.value || "Не указано"}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function WardrobeItemDetailsScreen({ navigation, route }) {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { items, categories, catalogs, outfits, actions } = useWardrobe();
  const [restoreVisible, setRestoreVisible] = useState(false);
  const [restoreCatalogId, setRestoreCatalogId] = useState("");
  const item = useMemo(() => items.find((entry) => entry.id === route.params?.itemId), [items, route.params?.itemId]);
  const category = categories.find((entry) => entry.id === item?.categoryId);
  const catalog = catalogs.find((entry) => entry.id === item?.catalogId);
  const status = getStatusMeta(item?.status);
  const relatedOutfits = useMemo(
    () => outfits.filter((outfit) => outfit.itemIds?.includes(route.params?.itemId)),
    [outfits, route.params?.itemId]
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: item?.title ?? "Вещь" });
  }, [item?.title, navigation]);

  if (!item) {
    return (
      <Screen padded>
        <EmptyState icon="alert-circle-outline" title="Вещь не найдена" subtitle="Вернитесь назад и выберите другую карточку." />
      </Screen>
    );
  }

  const confirmDelete = () => {
    Alert.alert("Удалить вещь?", "Действие нельзя будет отменить.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: () => {
          actions.deleteItem(item.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const infoRows = [
    { label: "Каталог", value: catalog?.title },
    { label: "Категория", value: category?.title },
    { label: "Подкатегория", value: item.subcategory },
    { label: "Цвет", value: (item.colors ?? []).join(", ") },
    { label: "Бренд", value: item.brand },
    { label: "Размер", value: item.size },
    { label: "Материал", value: item.material },
    { label: "Сезон", value: (item.seasons ?? []).join(", ") },
    { label: "Стиль", value: (item.styles ?? []).join(", ") },
    { label: "Дата добавления", value: item.createdAt },
    { label: "Статус", value: status.title },
    { label: "Заметки", value: item.notes },
  ];

  return (
    <Screen scroll padded>
      <MediaPreview
        source={item.image}
        placeholderScale={0.48}
        containerStyle={{
          width: "100%",
          aspectRatio: 1,
          borderRadius: radius.xl,
          backgroundColor: colors.secondaryBackground,
        }}
      />

      <View style={{ marginTop: spacing.md }}>
        <Text style={[typography.h2, { color: colors.text }]}>{item.title}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
          <Chip label={status.title} selected />
          {(item.styles ?? []).map((style) => (
            <Chip key={style} label={style} />
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
        <ActionButton
          label="Редактировать"
          icon="create-outline"
          variant="secondary"
          onPress={() => navigation.navigate(Routes.WardrobeConfirmItem, { itemId: item.id })}
        />
        <ActionButton
          label="Добавить в образ"
          icon="sparkles-outline"
          variant="secondary"
          onPress={() =>
            navigation.navigate("OutfitsTab", {
              screen: Routes.OutfitEditor,
              params: { seedItemId: item.id },
            })
          }
        />
        <ActionButton
          label={item.isArchived ? "Вернуть из архива" : "Архивировать"}
          icon="archive-outline"
          variant="secondary"
          onPress={() => {
            if (item.isArchived) {
              setRestoreCatalogId(item.catalogId || catalogs[0]?.id || "");
              setRestoreVisible(true);
              return;
            }

            actions.archiveItem(item.id);
          }}
        />
        <ActionButton label="Удалить" icon="trash-outline" variant="danger" onPress={confirmDelete} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Параметры" />
        <InfoTable rows={infoRows} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Образы с этой вещью" />
        {relatedOutfits.length ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {relatedOutfits.map((outfit) => (
              <View
                key={outfit.id}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  backgroundColor: colors.secondaryBackground,
                  padding: spacing.md,
                }}
              >
                <Text style={[typography.cardTitle, { color: colors.text }]}>{outfit.title}</Text>
                <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 4 }]}>
                  {(outfit.tags ?? []).join(", ")} · {(outfit.season ?? []).join(", ")}
                </Text>
                <ActionButton
                  label="Открыть образ"
                  variant="ghost"
                  compact
                  onPress={() =>
                    navigation.navigate("OutfitsTab", {
                      screen: Routes.OutfitDetails,
                      params: { outfitId: outfit.id },
                    })
                  }
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="sparkles-outline"
            title="Пока нет образов с этой вещью"
            subtitle="Можно сразу использовать карточку при создании нового образа."
            actionLabel="Собрать образ"
            onAction={() =>
              navigation.navigate("OutfitsTab", {
                screen: Routes.OutfitEditor,
                params: { seedItemId: item.id },
              })
            }
          />
        )}
      </View>

      <SheetModal
        visible={restoreVisible}
        onClose={() => setRestoreVisible(false)}
        title="Вернуть из архива"
        subtitle="Выберите каталог, в который вещь вернется после восстановления"
        footer={
          <ActionButton
            label="Восстановить"
            onPress={() => {
              actions.updateItem(item.id, { catalogId: restoreCatalogId, status: "active", isArchived: false });
              setRestoreVisible(false);
            }}
            disabled={!restoreCatalogId}
            fullWidth
          />
        }
      >
        <View style={{ gap: spacing.sm }}>
          {catalogs.map((entry) => {
            const selected = restoreCatalogId === entry.id;

            return (
              <ActionButton
                key={entry.id}
                label={entry.title}
                variant={selected ? "primary" : "secondary"}
                onPress={() => setRestoreCatalogId(entry.id)}
                fullWidth
              />
            );
          })}
        </View>
      </SheetModal>
    </Screen>
  );
}
