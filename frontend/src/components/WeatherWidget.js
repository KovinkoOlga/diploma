import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";

export default function WeatherWidget({ weather }) {
  const { colors, spacing, typography, radius } = useAppTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.bg2 ?? colors.card2,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.md,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Text style={[typography.caption, { color: colors.mutedText }]} numberOfLines={1}>
            Погода · {weather.city}
          </Text>
          <Text style={[typography.h1, { marginTop: spacing.xs, color: colors.text }]}>
            {weather.temperatureC}°C
          </Text>
          <Text style={[typography.body, { marginTop: 2, color: colors.mutedText }]} numberOfLines={2}>
            {weather.condition} · ощущается {weather.feelsLikeC}°C
          </Text>
        </View>
        <Ionicons name={weather.icon} size={18} color={colors.mutedText} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
