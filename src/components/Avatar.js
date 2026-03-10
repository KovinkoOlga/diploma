import React from "react";
import { Image, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";

export default function Avatar({ size = 40, label = "", source }) {
  const { colors, typography, radius } = useAppTheme();
  const initials = String(label)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (source) {
    return (
      <Image
        source={source}
        style={{
          width: size,
          height: size,
          borderRadius: radius.pill,
          backgroundColor: colors.avatarBackground,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.avatarBackground,
      }}
    >
      <Text style={[typography.cardTitle, { color: colors.text }]}>{initials || "U"}</Text>
    </View>
  );
}
