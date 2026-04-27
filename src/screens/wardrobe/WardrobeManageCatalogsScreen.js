import React, { useState } from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import ActionButton from "../../components/ActionButton";
import Input from "../../components/Input";
import SectionHeader from "../../components/SectionHeader";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";

export default function WardrobeManageCatalogsScreen() {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { catalogs, items, actions } = useWardrobe();
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");

  return (
    <Screen scroll padded withKeyboard>
      <SectionHeader title="Каталоги" />
      <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.sm }]}>
        Каталог объединяет вещи по назначению: повседневные, домашние или тренировочные.
      </Text>

      <View
        style={{
          marginTop: spacing.lg,
          padding: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: colors.secondaryBackground,
        }}
      >
        <Text style={[typography.cardTitle, { color: colors.text }]}>Новый каталог</Text>
        <Input value={newTitle} onChangeText={setNewTitle} placeholder="Например, Отпуск" style={{ marginTop: spacing.sm }} />
        <ActionButton
          label="Добавить каталог"
          icon="add-outline"
          onPress={() => {
            if (!newTitle.trim()) return;
            actions.addCatalog(newTitle);
            setNewTitle("");
          }}
          style={{ marginTop: spacing.sm }}
          fullWidth
        />
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {catalogs.map((catalog) => {
          const itemCount = items.filter((item) => item.catalogId === catalog.id && !item.isArchived).length;
          const editing = editingId === catalog.id;

          return (
            <View
              key={catalog.id}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                backgroundColor: colors.secondaryBackground,
                padding: spacing.md,
              }}
            >
              {editing ? (
                <Input value={editingTitle} onChangeText={setEditingTitle} style={{ marginBottom: spacing.sm }} />
              ) : (
                <Text style={[typography.cardTitle, { color: colors.text }]}>{catalog.title}</Text>
              )}
              <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 4 }]}>
                {itemCount} вещей в каталоге
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                {editing ? (
                  <>
                    <ActionButton
                      label="Сохранить"
                      variant="secondary"
                      onPress={() => {
                        if (!editingTitle.trim()) return;
                        actions.updateCatalog(catalog.id, { title: editingTitle.trim() });
                        setEditingId("");
                        setEditingTitle("");
                      }}
                    />
                    <ActionButton
                      label="Отмена"
                      variant="ghost"
                      onPress={() => {
                        setEditingId("");
                        setEditingTitle("");
                      }}
                    />
                  </>
                ) : (
                  <ActionButton
                    label="Переименовать"
                    variant="secondary"
                    onPress={() => {
                      setEditingId(catalog.id);
                      setEditingTitle(catalog.title);
                    }}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
