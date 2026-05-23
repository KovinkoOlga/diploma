import React, { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import ActionButton from "../../components/ActionButton";
import Input from "../../components/Input";
import Screen from "../../components/Screen";
import SectionHeader from "../../components/SectionHeader";
import SegmentedControl from "../../components/SegmentedControl";
import SheetModal from "../../components/SheetModal";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAppTheme } from "../../theme/ThemeProvider";
import { formatOutfitCount } from "../../utils/outfits";
import { formatWardrobeItemCount } from "../../utils/wardrobe";

const SECTION_OPTIONS = [
  { value: "catalogs", label: "Каталоги" },
  { value: "subcategories", label: "Подкатегории" },
  { value: "styles", label: "Стили" },
  { value: "brands", label: "Бренды" },
];

function DictionaryCard({ title, subtitle, meta, onRename, onDelete }) {
  const { colors, typography, spacing, radius } = useAppTheme();

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        backgroundColor: colors.secondaryBackground,
        padding: spacing.md,
      }}
    >
      <Text style={[typography.cardTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 4 }]}>{subtitle}</Text> : null}
      {meta ? <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 2 }]}>{meta}</Text> : null}
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
        <ActionButton label="Переименовать" variant="secondary" onPress={onRename} />
        {onDelete ? <ActionButton label="Удалить" variant="ghost" onPress={onDelete} /> : null}
      </View>
    </View>
  );
}

function buildStyleMeta(entry) {
  const parts = [];
  if (typeof entry.itemCount === "number") parts.push(formatWardrobeItemCount(entry.itemCount));
  if (typeof entry.outfitCount === "number") parts.push(formatOutfitCount(entry.outfitCount));
  return parts.join(" · ");
}

export default function WardrobeManageCatalogsScreen() {
  const { colors, typography, spacing, radius } = useAppTheme();
  const {
    catalogs,
    items,
    dictionarySubcategories,
    dictionaryStyles,
    dictionaryBrands,
    actions,
  } = useWardrobe();
  const [activeSection, setActiveSection] = useState("catalogs");
  const [newCatalogTitle, setNewCatalogTitle] = useState("");
  const [modalState, setModalState] = useState({
    visible: false,
    mode: "catalog",
    id: "",
    title: "",
    value: "",
  });
  const [saving, setSaving] = useState(false);

  const sectionDescription = useMemo(() => {
    switch (activeSection) {
      case "catalogs":
        return "Каталоги помогают группировать вещи по назначению: повседневные, домашние, отпуск и другие наборы.";
      case "subcategories":
        return "Здесь можно управлять только вашими пользовательскими подкатегориями. Системные значения скрыты.";
      case "styles":
        return "Пользовательские стили появляются после сохранения вещей и потом доступны для переименования или удаления.";
      case "brands":
        return "Бренды создаются из карточек вещей и остаются в вашем личном справочнике.";
      default:
        return "";
    }
  }, [activeSection]);

  const openRenameModal = (mode, entry) => {
    setModalState({
      visible: true,
      mode,
      id: entry.id,
      title:
        mode === "catalog"
          ? "Переименовать каталог"
          : mode === "subcategory"
            ? "Переименовать подкатегорию"
            : mode === "style"
              ? "Переименовать стиль"
              : "Переименовать бренд",
      value: entry.name ?? entry.title ?? "",
    });
  };

  const closeModal = () => {
    if (saving) return;
    setModalState((current) => ({ ...current, visible: false }));
  };

  const submitRename = async () => {
    const value = modalState.value.trim();
    if (!value) return;

    setSaving(true);
    try {
      if (modalState.mode === "catalog") {
        await actions.updateCatalog(modalState.id, { title: value });
      } else if (modalState.mode === "subcategory") {
        await actions.renameSubcategory(modalState.id, value);
      } else if (modalState.mode === "style") {
        await actions.renameStyle(modalState.id, value);
      } else {
        await actions.renameBrand(modalState.id, value);
      }
      setModalState((current) => ({ ...current, visible: false, value: "" }));
    } catch (error) {
      Alert.alert("Не удалось сохранить", error.message || "Попробуйте еще раз");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (mode, entry) => {
    const label =
      mode === "subcategory"
        ? "подкатегорию"
        : mode === "style"
          ? "стиль"
          : "бренд";

    Alert.alert(
      `Удалить ${label}?`,
      "Если значение используется в вещах, удаление будет недоступно.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              if (mode === "subcategory") {
                await actions.deleteSubcategory(entry.id);
              } else if (mode === "style") {
                await actions.deleteStyle(entry.id);
              } else {
                await actions.deleteBrand(entry.id);
              }
            } catch (error) {
              Alert.alert(
                "Удаление недоступно",
                error.message || "Сначала уберите или замените это значение в карточках вещей"
              );
            }
          },
        },
      ]
    );
  };

  const renderCatalogs = () => (
    <>
      <View
        style={{
          marginTop: spacing.lg,
          padding: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: colors.secondaryBackground,
        }}
      >
        <Text style={[typography.cardTitle, { color: colors.text }]}>Новый каталог</Text>
        <Input
          value={newCatalogTitle}
          onChangeText={setNewCatalogTitle}
          placeholder="Например, Отпуск"
          style={{ marginTop: spacing.sm }}
        />
        <ActionButton
          label="Добавить каталог"
          icon="add-outline"
          onPress={async () => {
            const value = newCatalogTitle.trim();
            if (!value) return;
            try {
              await actions.addCatalog(value);
              setNewCatalogTitle("");
            } catch (error) {
              Alert.alert("Не удалось создать каталог", error.message || "Попробуйте еще раз");
            }
          }}
          style={{ marginTop: spacing.sm }}
          fullWidth
        />
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {catalogs.map((catalog) => (
          <DictionaryCard
            key={catalog.id}
            title={catalog.title}
            meta={
              catalog.isDefault
                ? `Каталог по умолчанию · ${formatWardrobeItemCount(items.filter((item) => item.catalogId === catalog.id && !item.isArchived).length)}`
                : formatWardrobeItemCount(items.filter((item) => item.catalogId === catalog.id && !item.isArchived).length)
            }
            onRename={() => openRenameModal("catalog", catalog)}
          />
        ))}
      </View>
    </>
  );

  const renderList = (entries, mode, getSubtitle) => {
    if (!entries.length) {
      return (
        <View
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.secondaryBackground,
          }}
        >
          <Text style={[typography.body, { color: colors.secondaryText }]}>Пока здесь пусто.</Text>
        </View>
      );
    }

    return (
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {entries.map((entry) => (
          <DictionaryCard
            key={entry.id}
            title={entry.name}
            subtitle={getSubtitle?.(entry) ?? null}
            meta={mode === "style" ? buildStyleMeta(entry) : typeof entry.itemCount === "number" ? formatWardrobeItemCount(entry.itemCount) : null}
            onRename={() => openRenameModal(mode, entry)}
            onDelete={() => confirmDelete(mode, entry)}
          />
        ))}
      </View>
    );
  };

  return (
    <Screen scroll padded withKeyboard>
      <SectionHeader title="Справочники" />
      <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.sm }]}>{sectionDescription}</Text>

      <View style={{ marginTop: spacing.lg }}>
        <SegmentedControl options={SECTION_OPTIONS} value={activeSection} onChange={setActiveSection} />
      </View>

      {activeSection === "catalogs" ? renderCatalogs() : null}
      {activeSection === "subcategories"
        ? renderList(dictionarySubcategories, "subcategory", (entry) => entry.categoryTitle)
        : null}
      {activeSection === "styles" ? renderList(dictionaryStyles, "style") : null}
      {activeSection === "brands" ? renderList(dictionaryBrands, "brand") : null}

      <SheetModal
        visible={modalState.visible}
        onClose={closeModal}
        title={modalState.title}
        withKeyboard
        footer={
          <View style={{ gap: spacing.sm }}>
            <ActionButton
              label={saving ? "Сохраняем..." : "Сохранить"}
              onPress={submitRename}
              disabled={saving}
              fullWidth
            />
            <ActionButton label="Отмена" variant="secondary" onPress={closeModal} disabled={saving} fullWidth />
          </View>
        }
      >
        <Input value={modalState.value} onChangeText={(value) => setModalState((current) => ({ ...current, value }))} />
      </SheetModal>
    </Screen>
  );
}
