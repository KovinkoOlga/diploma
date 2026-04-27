import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Modal, PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../theme/ThemeProvider";

const OPEN_DURATION = 260;
const CLOSE_DURATION = 200;

export default function SheetModal({ visible, onClose, title, subtitle, children, footer }) {
  const { colors, spacing, radius, typography } = useAppTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);

  const translateY = Animated.add(
    dragY,
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: [420, 0],
    })
  );

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const openSheet = () => {
    closingRef.current = false;
    dragY.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: OPEN_DURATION,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = (callback = onClose) => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 0,
        duration: CLOSE_DURATION,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),
      Animated.timing(dragY, {
        toValue: 0,
        duration: CLOSE_DURATION,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        callback?.();
      }
    });
  };

  useEffect(() => {
    if (visible) {
      openSheet();
      return;
    }

    closingRef.current = false;
    progress.setValue(0);
    dragY.setValue(0);
  }, [dragY, progress, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.1,
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            dragY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 110 || gestureState.vy > 1) {
            closeSheet();
            return;
          }

          Animated.spring(dragY, {
            toValue: 0,
            damping: 22,
            stiffness: 260,
            mass: 0.55,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragY, {
            toValue: 0,
            damping: 22,
            stiffness: 260,
            mass: 0.55,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dragY]
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => closeSheet()}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          style={{
            ...StyleSheetAbsoluteFillObject,
            backgroundColor: "rgba(17,17,17,0.34)",
            opacity: backdropOpacity,
          }}
        />
        <Pressable style={StyleSheetAbsoluteFillObject} onPress={() => closeSheet()} />
        <Animated.View style={{ transform: [{ translateY }] }}>
          <SafeAreaView
            edges={["bottom"]}
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: spacing.md,
            }}
          >
            <View
              {...panResponder.panHandlers}
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.xs,
                paddingBottom: spacing.xs,
                minHeight: 48,
                justifyContent: "flex-start",
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 5,
                  borderRadius: radius.pill,
                  backgroundColor: colors.border,
                  alignSelf: "center",
                  marginBottom: spacing.sm,
                }}
              />
              <Text style={[typography.sectionTitle, { color: colors.text }]}>{title}</Text>
              {subtitle ? (
                <Text style={[typography.caption, { color: colors.secondaryText, marginTop: 4 }]}>{subtitle}</Text>
              ) : null}
            </View>
            <ScrollView
              style={{ maxHeight: 520, marginTop: spacing.sm }}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            {footer ? <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>{footer}</View> : null}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleSheetAbsoluteFillObject = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
