import React from "react";
import { Text, View } from "react-native";
import Card from "../../../components/Card";
import EmptyState from "../../../components/EmptyState";
import { useAppTheme } from "../../../theme/ThemeProvider";
import DonutChart from "./DonutChart";
import HistogramChart from "./HistogramChart";

export default function WardrobeUsageCard({ periodLabel, usage, histogramData = [], borderStyle }) {
  const { colors, typography, spacing, radius } = useAppTheme();

  return (
    <Card style={{ padding: spacing.md, ...borderStyle }}>
      <Text style={[typography.sectionTitle, { color: colors.text }]}>Использование гардероба</Text>
      <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 4 }]}>{periodLabel}</Text>

      <View style={{ marginTop: spacing.md, alignItems: "center" }}>
        <DonutChart value={usage.usagePercent} centerLabel={`${usage.usagePercent}%`} />
        <Text
          style={[
            typography.h3,
            {
              color: colors.text,
              marginTop: spacing.md,
              textAlign: "center",
            },
          ]}
        >
          Использовано {usage.usedCount} из {usage.activeCount} вещей
        </Text>
        <Text style={[typography.body, { color: colors.secondaryText, marginTop: 6 }]}>
          Дней с отметками: {usage.markedDaysCount}
        </Text>
      </View>

      <View
        style={{
          marginTop: spacing.md,
          padding: spacing.sm,
          borderRadius: radius.md,
          backgroundColor: colors.secondaryBackground,
        }}
      >
        <Text style={[typography.caption, { color: colors.secondaryText }]}>
          Активные вещи считаются только по неархивным категориям, кроме сумок и аксессуаров.
        </Text>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Text style={[typography.cardTitle, { color: colors.text, textAlign: "center" }]}>Дни с отметками по периодам</Text>
      </View>

      <View style={{ marginTop: spacing.md, width: "100%", alignItems: "center" }}>
        {histogramData.length ? (
          <HistogramChart data={histogramData} height={112} compactLabels fillWidth />
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="В выбранном периоде пока нет отметок"
            subtitle="Когда начнут появляться wear logs, здесь появится распределение дней с отметками."
          />
        )}
      </View>
    </Card>
  );
}
