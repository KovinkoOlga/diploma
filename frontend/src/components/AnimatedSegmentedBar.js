import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";

export default function AnimatedSegmentedBar({ options, activeValue, onSelect }) {
  const { colors, spacing, typography, radius } = useAppTheme();
  const scrollRef = useRef(null);
  const layoutsRef = useRef({});
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const layout = layoutsRef.current[activeValue];
    if (!layout) return;

    if (!ready) {
      indicatorX.setValue(layout.x);
      indicatorWidth.setValue(layout.width);
      setReady(true);
      return;
    }

    Animated.parallel([
      Animated.timing(indicatorX, {
        toValue: layout.x,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(indicatorWidth, {
        toValue: layout.width,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();

    scrollRef.current?.scrollTo({
      x: Math.max(layout.x - 40, 0),
      animated: true,
    });
  }, [activeValue, indicatorWidth, indicatorX, ready]);

  return (
    <View
      style={{
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBackground,
        padding: 4,
        overflow: "hidden",
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ borderRadius: radius.pill, overflow: "hidden" }}
        contentContainerStyle={{ position: "relative", flexDirection: "row", alignItems: "center", gap: 4 }}
      >
        {ready ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: indicatorX,
              width: indicatorWidth,
              borderRadius: radius.pill,
              backgroundColor: colors.text,
            }}
          />
        ) : null}
        {options.map((option) => {
          const selected = activeValue === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              onLayout={({ nativeEvent }) => {
                layoutsRef.current[option.value] = {
                  x: nativeEvent.layout.x,
                  width: nativeEvent.layout.width,
                };
                if (option.value === activeValue && !ready) {
                  indicatorX.setValue(nativeEvent.layout.x);
                  indicatorWidth.setValue(nativeEvent.layout.width);
                  setReady(true);
                }
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.84 : 1 }]}
            >
              <View
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs + 2,
                  minHeight: 36,
                  justifyContent: "center",
                }}
              >
                <Text
                  style={[
                    typography.caption,
                    {
                      color: selected ? colors.background : colors.text,
                      fontWeight: selected ? "600" : "500",
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
