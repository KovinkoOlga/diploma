import React, { useState } from "react";
import { Text, View } from "react-native";
import Screen from "../../components/Screen";
import ActionButton from "../../components/ActionButton";
import Input from "../../components/Input";
import SectionHeader from "../../components/SectionHeader";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useWardrobe } from "../../store/WardrobeStore";

export default function WardrobeManageCategoriesScreen() {
  const { colors, typography, spacing, radius } = useAppTheme();
  const { categories, items, actions } = useWardrobe();
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingSubcategories, setEditingSubcategories] = useState("");

  return (
    <Screen scroll padded withKeyboard>
      <SectionHeader title="Категории" />
      <Text style={[typography.body, { color: colors.secondaryText, marginTop: spacing.sm }]}>
        Категория описывает тип вещи: верх, низ, обувь, сумки и так далее.
      </Text>

      <View
        style={{
          marginTop: spacing.lg,
          padding: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: colors.secondaryBackground,
        }}
      >
        <Text style={[typography.cardTitle, { color: colors.text }]}>Новая категория</Text>
        <Input value={newTitle} onChangeText={setNewTitle} placeholder="Например, Купальники" style={{ marginTop: spacing.sm }} />
        <ActionButton
          label="Добавить категорию"
          icon="add-outline"
          onPress={() => {
            if (!newTitle.trim()) return;
            actions.addCategory({ title: newTitle.trim() });
            setNewTitle("");
          }}
          style={{ marginTop: spacing.sm }}
          fullWidth
        />
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {categories.map((category) => {
          const itemCount = items.filter((item) => item.categoryId === category.id && !item.isArchived).length;
          const editing = editingId === category.id;

          return (
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
              {editing ? (
                <>
                  <Input value={editingTitle} onChangeText={setEditingTitle} style={{ marginBottom: spacing.sm }} />
                  <Input
                    value={editingSubcategories}
                    onChangeText={setEditingSubcategories}
                    placeholder="Подкатегории через запятую"
                  />
                </>
              ) : (
                <>
                  <Text style={[typography.cardTitle, { color: colors.text }]}>{category.title}</Text>
                  <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 4 }]}>
                    {(category.subcategories ?? []).join(", ") || "Подкатегории пока не настроены"}
                  </Text>
                </>
              )}
              <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 8 }]}>
                {itemCount} вещей в категории
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                {editing ? (
                  <>
                    <ActionButton
                      label="Сохранить"
                      variant="secondary"
                      onPress={() => {
                        if (!editingTitle.trim()) return;
                        actions.updateCategory(category.id, {
                          title: editingTitle.trim(),
                          subcategories: editingSubcategories
                            .split(",")
                            .map((entry) => entry.trim())
                            .filter(Boolean),
                        });
                        setEditingId("");
                        setEditingTitle("");
                        setEditingSubcategories("");
                      }}
                    />
                    <ActionButton
                      label="Отмена"
                      variant="ghost"
                      onPress={() => {
                        setEditingId("");
                        setEditingTitle("");
                        setEditingSubcategories("");
                      }}
                    />
                  </>
                ) : (
                  <ActionButton
                    label="Переименовать"
                    variant="secondary"
                    onPress={() => {
                      setEditingId(category.id);
                      setEditingTitle(category.title);
                      setEditingSubcategories((category.subcategories ?? []).join(", "));
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
