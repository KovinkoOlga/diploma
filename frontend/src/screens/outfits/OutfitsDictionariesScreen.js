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
  { value: "collections", label: "Подборки" },
  { value: "styles", label: "Стили" },
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

function buildStyleMeta(style) {
  const parts = [];
  if (typeof style.itemCount === "number") parts.push(formatWardrobeItemCount(style.itemCount));
  if (typeof style.outfitCount === "number") parts.push(formatOutfitCount(style.outfitCount));
  return parts.join(" · ");
}

export default function OutfitsDictionariesScreen() {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { outfitCollections, dictionaryStyles, actions } = useWardrobe();
  const [activeSection, setActiveSection] = useState("collections");
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [modalState, setModalState] = useState({
    visible: false,
    mode: "collection",
    id: "",
    title: "",
    value: "",
  });
  const [saving, setSaving] = useState(false);

  const sectionDescription = useMemo(() => {
    if (activeSection === "collections") {
      return "Подборки помогают разложить образы по капсулам, поводам и сезонам без дублирования самих образов.";
    }
    return "Стили здесь общие для вещей и образов. После удаления стиль будет очищен во всех связанных карточках.";
  }, [activeSection]);

  const openRenameModal = (mode, entry) => {
    setModalState({
      visible: true,
      mode,
      id: entry.id,
      title: mode === "collection" ? "Переименовать подборку" : "Переименовать стиль",
      value: entry.title ?? entry.name ?? "",
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
      if (modalState.mode === "collection") {
        await actions.updateOutfitCollection(modalState.id, { title: value });
      } else {
        await actions.renameStyle(modalState.id, value);
      }
      setModalState((current) => ({ ...current, visible: false, value: "" }));
    } catch (error) {
      Alert.alert("Не удалось сохранить", error.message || "Попробуйте ещё раз");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteCollection = (collection) => {
    Alert.alert(
      "Удалить подборку?",
      "Подборка будет удалена, но сами образы останутся и только потеряют эту связь.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              await actions.deleteOutfitCollection(collection.id);
            } catch (error) {
              Alert.alert("Не удалось удалить", error.message || "Попробуйте ещё раз");
            }
          },
        },
      ]
    );
  };

  const confirmDeleteStyle = (style) => {
    const used = Number(style.itemCount ?? 0) > 0 || Number(style.outfitCount ?? 0) > 0;
    const title = used ? "Стиль используется" : "Удалить стиль?";
    const message = used
      ? "Этот стиль используется в вещах или образах. Если удалить стиль, он будет очищен во всех связанных карточках. Всё равно удалить?"
      : "Стиль будет удалён из справочника.";
    const destructiveLabel = used ? "Всё равно удалить" : "Удалить";

    Alert.alert(title, message, [
      { text: "Отмена", style: "cancel" },
      {
        text: destructiveLabel,
        style: "destructive",
        onPress: async () => {
          try {
            await actions.deleteStyle(style.id);
          } catch (error) {
            Alert.alert("Не удалось удалить", error.message || "Попробуйте ещё раз");
          }
        },
      },
    ]);
  };

  const renderCollections = () => (
    <>
      <View
        style={{
          marginTop: spacing.lg,
          padding: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: colors.secondaryBackground,
        }}
      >
        <Text style={[typography.cardTitle, { color: colors.text }]}>Новая подборка</Text>
        <Input
          value={newCollectionTitle}
          onChangeText={setNewCollectionTitle}
          placeholder="Например, Отпуск"
          style={{ marginTop: spacing.sm }}
        />
        <ActionButton
          label="Добавить подборку"
          icon="add-outline"
          onPress={async () => {
            const value = newCollectionTitle.trim();
            if (!value) return;
            try {
              await actions.addOutfitCollection(value);
              setNewCollectionTitle("");
            } catch (error) {
              Alert.alert("Не удалось создать подборку", error.message || "Попробуйте ещё раз");
            }
          }}
          style={{ marginTop: spacing.sm }}
          fullWidth
        />
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {outfitCollections.length ? (
          outfitCollections.map((collection) => (
            <DictionaryCard
              key={collection.id}
              title={collection.title}
              meta={formatOutfitCount(collection.outfitCount ?? 0)}
              onRename={() => openRenameModal("collection", collection)}
              onDelete={() => confirmDeleteCollection(collection)}
            />
          ))
        ) : (
          <View
            style={{
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: colors.secondaryBackground,
              marginTop: spacing.lg,
            }}
          >
            <Text style={[typography.body, { color: colors.secondaryText }]}>Пока нет пользовательских подборок.</Text>
          </View>
        )}
      </View>
    </>
  );

  const renderStyles = () => (
    <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
      {dictionaryStyles.length ? (
        dictionaryStyles.map((style) => (
          <DictionaryCard
            key={style.id}
            title={style.name}
            meta={buildStyleMeta(style)}
            onRename={() => openRenameModal("style", style)}
            onDelete={() => confirmDeleteStyle(style)}
          />
        ))
      ) : (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.secondaryBackground,
          }}
        >
          <Text style={[typography.body, { color: colors.secondaryText }]}>Пользовательских стилей пока нет.</Text>
        </View>
      )}
    </View>
  );

  return (
    <Screen scroll padded withKeyboard>
      <SectionHeader title="Справочники образов" />
      <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.sm }]}>{sectionDescription}</Text>

      <View style={{ marginTop: spacing.lg }}>
        <SegmentedControl options={SECTION_OPTIONS} value={activeSection} onChange={setActiveSection} />
      </View>

      {activeSection === "collections" ? renderCollections() : null}
      {activeSection === "styles" ? renderStyles() : null}

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
