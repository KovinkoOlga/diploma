import React from "react";
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";

function hexToRgb(hex) {
  const normalized = String(hex ?? "")
    .trim()
    .replace("#", "");

  if (normalized.length !== 6) {
    return null;
  }

  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return null;
  }

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function isLightHex(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return false;
  }

  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness >= 215;
}

function CheckerLayer({ size, borderRadius }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        overflow: "hidden",
        flexDirection: "row",
        flexWrap: "wrap",
      }}
    >
      {Array.from({ length: 16 }).map((_, index) => (
        <View
          key={index}
          style={{
            width: size / 4,
            height: size / 4,
            backgroundColor: Math.floor(index / 4 + (index % 4)) % 2 === 0 ? "#F9FAFB" : "#D7DEE6",
          }}
        />
      ))}
    </View>
  );
}

export default function ColorDot({ colors = [], colorDetails = [], size = 18, variant, style }) {
  const { colors: themeColors } = useAppTheme();
  const borderRadius = size / 2;
  const entries = (colors?.length ? colors : colorDetails ?? []).filter(Boolean);
  const first = entries[0];
  const second = entries[1];
  const resolvedVariant =
    variant ??
    (first?.id === "transparent"
      ? "transparent"
      : first?.id === "multicolor"
        ? "multicolor"
        : entries.length >= 2
          ? "split"
          : "single");

  const borderColor =
    resolvedVariant === "single" && isLightHex(first?.hex) ? "#C7D0D9" : themeColors.border;
  const borderWidth = resolvedVariant === "single" && isLightHex(first?.hex) ? 1.2 : 1;

  if (!entries.length) {
    return (
      <View
        style={[
          styles.base,
          {
            width: size,
            height: size,
            borderRadius,
            borderColor: themeColors.border,
            backgroundColor: themeColors.background,
          },
          style,
        ]}
      />
    );
  }

  if (resolvedVariant === "transparent") {
    return (
      <View
        style={[
          styles.base,
          { width: size, height: size, borderRadius, borderColor: "#B8C4CF", borderWidth: 1.2, overflow: "hidden" },
          style,
        ]}
      >
        <CheckerLayer size={size} borderRadius={borderRadius} />
      </View>
    );
  }

  if (resolvedVariant === "multicolor") {
    const stripes = ["#E94B5B", "#F0C93C", "#4B8A55", "#3467B7", "#C73584"];
    return (
      <View
        style={[
          styles.base,
          { width: size, height: size, borderRadius, borderColor: themeColors.border, overflow: "hidden", flexDirection: "row" },
          style,
        ]}
      >
        {stripes.map((color) => (
          <View key={color} style={{ flex: 1, backgroundColor: color }} />
        ))}
      </View>
    );
  }

  if (resolvedVariant === "split" && second) {
    return (
      <View
        style={[
          styles.base,
          { width: size, height: size, borderRadius, borderColor: themeColors.border, overflow: "hidden", flexDirection: "row" },
          style,
        ]}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: first?.hex ?? themeColors.background,
            borderRightWidth: isLightHex(second?.hex) ? 1 : 0,
            borderRightColor: "rgba(17, 17, 17, 0.08)",
          }}
        />
        <View style={{ flex: 1, backgroundColor: second?.hex ?? themeColors.background }} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius,
          borderColor,
          borderWidth,
          backgroundColor: first?.hex ?? themeColors.background,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
