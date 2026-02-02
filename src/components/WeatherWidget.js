import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Card from "./Card";
import { useAppTheme } from "../theme/ThemeProvider";

export default function WeatherWidget({ weather }) {
  const { colors, spacing, typography } = useAppTheme();
  return (
    <Card style={{ padding: spacing.md }} variant="flat">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Text style={[typography.caption, { color: colors.mutedText, letterSpacing: 0.8, textTransform: "uppercase" }]}>
            Погода сегодня · {weather.city}
          </Text>
          <Text style={[typography.h2, { marginTop: spacing.xs, color: colors.text }]}>
            {weather.temperatureC}°C
          </Text>
          <Text style={[typography.body, { marginTop: 2, color: colors.mutedText }]}>
            {weather.condition} · ощущается {weather.feelsLikeC}°C
          </Text>
        </View>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: colors.chipBg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={weather.icon} size={22} color={colors.icon} />
        </View>
      </View>
    </Card>
  );
}
