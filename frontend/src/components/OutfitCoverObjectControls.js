import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";
import { MAX_OBJECT_SCALE, MIN_OBJECT_SCALE } from "../utils/outfitCover";

const SCALE_STEP = 0.08;
const ROTATION_STEP = 8;
const ROTATION_TRACK_MIN = -180;
const ROTATION_TRACK_MAX = 180;
const PANEL_BODY_HEIGHT = 160;
const FOOTER_HEIGHT = 40;
const LABEL_WIDTH = 80;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function TabButton({ label, active, onPress }) {
  const { colors, radius, spacing, typography } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.flexFill,
        {
          minHeight: 28,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.xs,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active ? colors.chipActiveBackground : "transparent",
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[typography.caption, { color: active ? colors.chipActiveText : colors.secondaryText }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function IconButton({ icon, onPress, disabled, accessibilityLabel, mirrored = false }) {
  const { colors, radius } = useAppTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 34,
          height: 34,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.35 : pressed ? 0.72 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={17} color={colors.text} style={mirrored ? styles.mirroredIcon : undefined} />
    </Pressable>
  );
}

function AdjustTrack({ progress, disabled }) {
  const { colors } = useAppTheme();
  const clampedProgress = clamp(progress, 0, 1);

  return (
    <View style={styles.trackWrap}>
      <View
        style={{
          height: 4,
          borderRadius: 999,
          backgroundColor: colors.divider,
          overflow: "hidden",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: `${clampedProgress * 100}%`,
            marginLeft: -5.5,
            width: 11,
            height: 11,
            borderRadius: 999,
            backgroundColor: colors.text,
            opacity: disabled ? 0.35 : 1,
          }}
        />
      </View>
    </View>
  );
}

function InlineAdjustRow({ label, value, progress, onDecrease, onIncrease, disabled }) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View style={[styles.adjustRow, { gap: spacing.xs }]}>
      <Text style={[typography.body, { color: colors.text, width: LABEL_WIDTH }]} numberOfLines={1}>
        {label}
      </Text>
      <IconButton icon="remove-outline" disabled={disabled} onPress={onDecrease} accessibilityLabel={`${label} минус`} />
      <AdjustTrack progress={progress} disabled={disabled} />
      <IconButton icon="add-outline" disabled={disabled} onPress={onIncrease} accessibilityLabel={`${label} плюс`} />
      <Text style={[typography.caption, styles.valueLabel, { color: colors.secondaryText }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function OptionChip({ icon, label, selected, disabled, onPress, mirrored = false, stacked = false, iconAlign = "center" }) {
  const { colors, radius, spacing, typography } = useAppTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.flexFill,
        {
          minHeight: stacked ? 54 : 30,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: selected ? colors.chipActiveBackground : colors.border,
          backgroundColor: selected ? colors.chipActiveBackground : colors.background,
          paddingHorizontal: spacing.xs,
          paddingVertical: stacked ? 5 : 0,
          flexDirection: stacked ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: icon ? (stacked ? 2 : spacing.xs) : 0,
          opacity: disabled ? 0.35 : pressed ? 0.72 : 1,
        },
      ]}
    >
        {icon ? (
          <Ionicons
            name={icon}
            size={15}
            color={selected ? colors.chipActiveText : colors.text}
            style={[
              mirrored ? styles.mirroredIcon : undefined,
              stacked
                ? iconAlign === "start"
                  ? styles.iconGlyphStart
                  : iconAlign === "end"
                    ? styles.iconGlyphEnd
                    : styles.iconGlyphCenter
                : undefined,
              ]}
          />
        ) : null}
      <Text
        numberOfLines={1}
        style={[
            typography.meta,
            { color: selected ? colors.chipActiveText : colors.text },
            stacked
              ? iconAlign === "start"
                ? styles.iconTextStart
                : iconAlign === "end"
                  ? styles.iconTextEnd
                  : styles.iconTextCenter
              : undefined,
          ]}
        >
        {label}
      </Text>
    </Pressable>
  );
}

function LabeledActionButton({ icon, label, onPress, disabled = false }) {
  const { colors, radius, spacing, typography } = useAppTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: FOOTER_HEIGHT,
          borderRadius: radius.pill,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.background,
          paddingHorizontal: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          opacity: disabled ? 0.35 : pressed ? 0.72 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={15} color={colors.text} />
      <Text style={[typography.meta, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function LayerButton({ icon, label, onPress, disabled }) {
  const { colors, radius, spacing, typography } = useAppTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.flexFill,
        {
          minHeight: 50,
          borderRadius: radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.background,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          opacity: disabled ? 0.35 : pressed ? 0.72 : 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 6,
        },
      ]}
    >
      <Ionicons name={icon} size={15} color={colors.text} />
      <Text style={[typography.meta, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function OutfitCoverObjectControls({
  selectedObject,
  onPatch,
  onReorder,
  onReset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) {
  const { colors, spacing, radius, typography } = useAppTheme();
  const [tab, setTab] = useState("position");

  const hasSelection = Boolean(selectedObject);
  const scaleValue = selectedObject?.scale ?? 1;
  const rotationValue = selectedObject?.rotation ?? 0;
  const isFlipped = Boolean(selectedObject?.flipX);

  const cropOptions = [
    { id: "left-half", label: "Левая часть", icon: "scan-outline", iconAlign: "start" },
    { id: "none", label: "Целиком", icon: "square-outline" },
    { id: "right-half", label: "Правая часть", icon: "scan-outline", mirrored: true, iconAlign: "end" },
  ];

  const layerOptions = [
    { id: "front", label: "На передний план", icon: "arrow-up-circle-outline" },
    { id: "back", label: "На задний план", icon: "arrow-down-circle-outline" },
    { id: "up", label: "Выше", icon: "chevron-up-outline" },
    { id: "down", label: "Ниже", icon: "chevron-down-outline" },
  ];

  const scaleProgress = hasSelection ? (scaleValue - MIN_OBJECT_SCALE) / (MAX_OBJECT_SCALE - MIN_OBJECT_SCALE) : 0.5;
  const rotationProgress = hasSelection
    ? (clamp(rotationValue, ROTATION_TRACK_MIN, ROTATION_TRACK_MAX) - ROTATION_TRACK_MIN) /
      (ROTATION_TRACK_MAX - ROTATION_TRACK_MIN)
    : 0.5;

  const patch = (value) => {
    if (!hasSelection) return;
    onPatch?.(value);
  };

  return (
    <View
      style={{
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBackground,
        padding: spacing.xs,
        gap: spacing.xs,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          borderRadius: radius.pill,
          backgroundColor: colors.background,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 2,
        }}
      >
        <TabButton label="Положение" active={tab === "position"} onPress={() => setTab("position")} />
        <TabButton label="Отображение" active={tab === "display"} onPress={() => setTab("display")} />
        <TabButton label="Слои" active={tab === "layers"} onPress={() => setTab("layers")} />
      </View>

      <View style={{ height: PANEL_BODY_HEIGHT, justifyContent: "space-between" }}>
        <View style={{ flex: 1, justifyContent: tab === "display" ? "center" : "flex-start", gap: 4 }}>
          {!hasSelection ? (
            <Text style={[typography.meta, { color: colors.secondaryText }]}>Выберите вещь на холсте</Text>
          ) : null}

          {tab === "position" ? (
            <View style={{ gap: 8 }}>
              <InlineAdjustRow
                label="Масштаб"
                value={hasSelection ? `${Math.round(scaleValue * 100)}%` : "—"}
                progress={scaleProgress}
                disabled={!hasSelection}
                onDecrease={() => patch({ scale: scaleValue - SCALE_STEP })}
                onIncrease={() => patch({ scale: scaleValue + SCALE_STEP })}
              />
              <InlineAdjustRow
                label="Поворот"
                value={hasSelection ? `${Math.round(rotationValue)}°` : "—"}
                progress={rotationProgress}
                disabled={!hasSelection}
                onDecrease={() => patch({ rotation: rotationValue - ROTATION_STEP })}
                onIncrease={() => patch({ rotation: rotationValue + ROTATION_STEP })}
              />
              <View style={[styles.rowCenter, { gap: spacing.xs, minHeight: 28, marginBottom: 4 }]}>
                <Text style={[typography.body, { color: colors.text, width: LABEL_WIDTH }]} numberOfLines={1}>
                  Отразить
                </Text>
                <OptionChip
                  icon="swap-horizontal-outline"
                  label="По вертикали"
                  selected={isFlipped}
                  disabled={!hasSelection}
                  onPress={() => onPatch?.({ flipX: !Boolean(selectedObject?.flipX) })}
                />
                <OptionChip
                  icon="swap-vertical-outline"
                  label="По горизонтали"
                  selected={false}
                  disabled={!hasSelection}
                  onPress={() =>
                    patch({
                      flipX: !Boolean(selectedObject?.flipX),
                      rotation: (Number(selectedObject?.rotation) || 0) + 180,
                    })
                  }
                />
              </View>
            </View>
          ) : null}

          {tab === "display" ? (
            <View style={[styles.rowCenter, styles.displayCenterRow, { gap: 6 }]}>
              {cropOptions.map((option) => (
                <OptionChip
                    key={option.id}
                    icon={option.icon}
                    mirrored={option.mirrored}
                    iconAlign={option.iconAlign}
                    stacked
                    selected={selectedObject?.crop === option.id}
                    disabled={!hasSelection}
                  label={option.label}
                  onPress={() => patch({ crop: option.id })}
                />
              ))}
            </View>
          ) : null}

          {tab === "layers" ? (
            <View style={{ gap: 6 }}>
              <View style={[styles.rowCenter, { gap: 6 }]}>
                {layerOptions.slice(0, 2).map((option) => (
                  <LayerButton
                    key={option.id}
                    icon={option.icon}
                    label={option.label}
                    disabled={!hasSelection}
                    onPress={() => onReorder?.(option.id)}
                  />
                ))}
              </View>
              <View style={[styles.rowCenter, { gap: 6 }]}>
                {layerOptions.slice(2).map((option) => (
                  <LayerButton
                    key={option.id}
                    icon={option.icon}
                    label={option.label}
                    disabled={!hasSelection}
                    onPress={() => onReorder?.(option.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.rowSpaceBetween}>
          <LabeledActionButton icon="refresh-circle-outline" label="Сброс" disabled={!hasSelection} onPress={onReset} />

          <View style={[styles.rowCenter, { gap: spacing.xs }]}>
            <IconButton icon="arrow-undo-outline" disabled={!canUndo} onPress={onUndo} accessibilityLabel="Шаг назад" />
            <IconButton icon="arrow-redo-outline" disabled={!canRedo} onPress={onRedo} accessibilityLabel="Шаг вперед" />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flexFill: {
    flex: 1,
  },
  trackWrap: {
    flex: 1,
    minWidth: 28,
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowSpaceBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  valueLabel: {
    width: 42,
    textAlign: "right",
  },
  adjustRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 28,
    width: "100%",
  },
  displayCenterRow: {
    justifyContent: "center",
  },
  iconGlyphStart: {
    alignSelf: "flex-start",
    marginLeft: 8,
  },
  iconGlyphCenter: {
    alignSelf: "center",
  },
  iconGlyphEnd: {
    alignSelf: "flex-end",
    marginRight: 8,
  },
  iconTextStart: {
    width: "100%",
    textAlign: "left",
    paddingLeft: 8,
  },
  iconTextCenter: {
    width: "100%",
    textAlign: "center",
  },
  iconTextEnd: {
    width: "100%",
    textAlign: "right",
    paddingRight: 8,
  },
  mirroredIcon: {
    transform: [{ scaleX: -1 }],
  },
});
