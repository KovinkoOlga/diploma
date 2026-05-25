import React from "react";
import { Text, View } from "react-native";
import ActionButton from "../../../components/ActionButton";
import Card from "../../../components/Card";
import { useAppTheme } from "../../../theme/ThemeProvider";

export default function DataQualityCard({ quality, itemsCount = 0, outfitsCount = 0, onOpenItems, onOpenOutfits, borderStyle }) {
  const { colors, typography, spacing, radius } = useAppTheme();

  return (
    <Card style={{ padding: spacing.md, ...borderStyle }}>
      <Text style={[typography.sectionTitle, { color: colors.text }]}>Качество данных</Text>
      <Text
        style={[
          typography.h3,
          {
            color: colors.text,
            marginTop: spacing.sm,
            fontVariant: ["tabular-nums"],
          },
        ]}
      >
        Заполненность данных: {quality.completenessPercent}%
      </Text>

      <View
        style={{
          marginTop: spacing.sm,
          height: 10,
          borderRadius: radius.pill,
          overflow: "hidden",
          backgroundColor: colors.accentSoft,
        }}
      >
        <View
          style={{
            width: `${Math.max(0, Math.min(100, quality.completenessPercent))}%`,
            height: "100%",
            borderRadius: radius.pill,
            backgroundColor: colors.text,
          }}
        />
      </View>

      {quality.hasIssues ? (
        <View style={{ gap: 8, marginTop: spacing.md }}>
          {quality.issues.map((issue) => (
            <View
              key={issue.id}
              style={{
                padding: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colors.secondaryBackground,
              }}
            >
              <Text style={[typography.body, { color: colors.text }]}>{issue.label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.secondaryBackground,
          }}
        >
          <Text style={[typography.cardTitle, { color: colors.text }]}>Данные заполнены хорошо</Text>
          <Text style={[typography.body, { color: colors.secondaryText, marginTop: 6 }]}>
            Подбор образов и статистика будут точнее.
          </Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
        <ActionButton
          label={`Вещи · ${itemsCount}`}
          variant="secondary"
          onPress={onOpenItems}
          style={{ flex: 1 }}
          fullWidth
        />
        <ActionButton
          label={`Образы · ${outfitsCount}`}
          variant="secondary"
          onPress={onOpenOutfits}
          style={{ flex: 1 }}
          fullWidth
        />
      </View>
    </Card>
  );
}
