import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Canvas, Circle, Path, Skia } from "@shopify/react-native-skia";
import { useAppTheme } from "../../../theme/ThemeProvider";

export default function DonutChart({
  value = 0,
  size = 136,
  strokeWidth = 16,
  centerLabel = "",
  centerCaption = "",
}) {
  const { colors, typography } = useAppTheme();
  const clampedValue = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circleSize = radius * 2;

  const progressPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addArc(
      {
        x: strokeWidth / 2,
        y: strokeWidth / 2,
        width: circleSize,
        height: circleSize,
      },
      -90,
      (clampedValue / 100) * 360
    );
    return path;
  }, [circleSize, clampedValue, strokeWidth]);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Canvas style={{ width: size, height: size }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          color={colors.border}
          style="stroke"
          strokeWidth={strokeWidth}
        />
        {clampedValue > 0 ? (
          <Path
            path={progressPath}
            color={colors.text}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
          />
        ) : null}
      </Canvas>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        <Text
          style={[
            typography.h2,
            {
              color: colors.text,
              fontVariant: ["tabular-nums"],
            },
          ]}
        >
          {centerLabel}
        </Text>
        {centerCaption ? (
          <Text style={[typography.meta, { color: colors.secondaryText, marginTop: 2 }]}>{centerCaption}</Text>
        ) : null}
      </View>
    </View>
  );
}
