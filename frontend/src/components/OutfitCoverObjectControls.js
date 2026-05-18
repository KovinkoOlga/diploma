import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";

function ToolButton({ icon, label, onPress, active = false, disabled = false, iconStyle }) {
  const { colors, spacing, radius, typography } = useAppTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 66,
          minHeight: 58,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: active ? colors.text : colors.border,
          backgroundColor: active ? colors.accentSoft : colors.background,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.xs,
          paddingVertical: 6,
          opacity: disabled ? 0.35 : pressed ? 0.72 : 1,
          gap: 2,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.text} style={iconStyle} />
      <Text style={[typography.meta, { color: colors.secondaryText, fontSize: 10 }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function MiniOptionButton({ icon, label, selected, disabled, onPress }) {
  const { colors, spacing, radius, typography } = useAppTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minWidth: 98,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: selected ? colors.text : colors.border,
          backgroundColor: selected ? colors.accentSoft : colors.background,
          paddingHorizontal: spacing.sm,
          paddingVertical: 7,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          opacity: disabled ? 0.35 : pressed ? 0.72 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={colors.text} />
      <Text style={[typography.meta, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function OutfitCoverObjectControls({
  selectedObject,
  onPatch,
  onReorder,
  onReset,
  onUndo,
  canUndo,
}) {
  const { spacing, typography, colors, radius } = useAppTheme();
  const [menu, setMenu] = useState(null);

  const hasSelection = Boolean(selectedObject);

  const cropOptions = useMemo(
    () => [
      { id: "none", label: "Без", icon: "square-outline", selected: selectedObject?.crop === "none" },
      { id: "left-half", label: "Лево", icon: "caret-back-outline", selected: selectedObject?.crop === "left-half" },
      { id: "right-half", label: "Право", icon: "caret-forward-outline", selected: selectedObject?.crop === "right-half" },
    ],
    [selectedObject?.crop]
  );

  const layerOptions = [
    { id: "front", label: "Вперед", icon: "arrow-up-outline" },
    { id: "back", label: "Назад", icon: "arrow-down-outline" },
    { id: "up", label: "Выше", icon: "chevron-up-outline" },
    { id: "down", label: "Ниже", icon: "chevron-down-outline" },
  ];

  const patch = (value) => {
    if (!hasSelection) return;
    onPatch?.(value);
  };

  return (
    <View
      style={{
        marginTop: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBackground,
        paddingVertical: spacing.xs,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xs,
          gap: spacing.xs,
          alignItems: "center",
        }}
      >
        <ToolButton
          icon="add-outline"
          label="Scale+"
          disabled={!hasSelection}
          onPress={() => patch({ scale: (selectedObject?.scale ?? 1) + 0.08 })}
        />
        <ToolButton
          icon="remove-outline"
          label="Scale-"
          disabled={!hasSelection}
          onPress={() => patch({ scale: (selectedObject?.scale ?? 1) - 0.08 })}
        />
        <ToolButton
          icon="refresh-outline"
          label="Rot+"
          disabled={!hasSelection}
          onPress={() => patch({ rotation: (selectedObject?.rotation ?? 0) + 8 })}
        />
        <ToolButton
          icon="refresh-outline"
          label="Rot-"
          iconStyle={styles.flippedIcon}
          disabled={!hasSelection}
          onPress={() => patch({ rotation: (selectedObject?.rotation ?? 0) - 8 })}
        />
        <ToolButton
          icon="swap-horizontal-outline"
          label="Flip"
          disabled={!hasSelection}
          onPress={() => patch({ flipX: !selectedObject?.flipX })}
        />
        <ToolButton
          icon="cut-outline"
          label="Crop"
          active={menu === "crop"}
          disabled={!hasSelection}
          onPress={() => setMenu((current) => (current === "crop" ? null : "crop"))}
        />
        <ToolButton
          icon="layers-outline"
          label="Layer"
          active={menu === "layer"}
          disabled={!hasSelection}
          onPress={() => setMenu((current) => (current === "layer" ? null : "layer"))}
        />
        <ToolButton icon="refresh-circle-outline" label="Reset" disabled={!hasSelection} onPress={onReset} />
        <ToolButton icon="arrow-undo-outline" label="Undo" disabled={!canUndo} onPress={onUndo} />
      </ScrollView>

      {menu === "crop" && hasSelection ? (
        <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.xs, gap: spacing.xs }}>
          <Text style={[typography.meta, { color: colors.secondaryText }]}>Обрезка</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {cropOptions.map((option) => (
              <MiniOptionButton
                key={option.id}
                icon={option.icon}
                label={option.label}
                selected={option.selected}
                onPress={() => {
                  onPatch?.({ crop: option.id });
                  setMenu(null);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {menu === "layer" && hasSelection ? (
        <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.xs, gap: spacing.xs }}>
          <Text style={[typography.meta, { color: colors.secondaryText }]}>Порядок слоя</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {layerOptions.map((option) => (
              <MiniOptionButton
                key={option.id}
                icon={option.icon}
                label={option.label}
                onPress={() => {
                  onReorder?.(option.id);
                  setMenu(null);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {!hasSelection ? (
        <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.xs }}>
          <Text style={[typography.caption, { color: colors.secondaryText }]}>Выберите вещь на полотне, чтобы редактировать.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flippedIcon: {
    transform: [{ scaleX: -1 }],
  },
});
