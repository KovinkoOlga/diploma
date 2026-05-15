import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../theme/ThemeProvider";

export function useScreenContentInsets(extraBottom = 0) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;

  return {
    top: 8,
    bottom: tabBarHeight + extraBottom,
    safeTop: insets.top,
    safeBottom: insets.bottom,
  };
}

export default function Screen({
  children,
  header,
  scroll = false,
  padded = false,
  withKeyboard = false,
  style,
  contentStyle,
  contentContainerStyle,
  edges = ["left", "right"],
  showsVerticalScrollIndicator = false,
  keyboardShouldPersistTaps = "handled",
}) {
  const { colors, layout } = useAppTheme();
  const { bottom } = useScreenContentInsets(16);
  const horizontalPadding = padded ? layout.screenPadding : 0;

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        {
          paddingHorizontal: horizontalPadding,
          paddingTop: 8,
          paddingBottom: bottom,
        },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        {
          flex: 1,
          paddingHorizontal: horizontalPadding,
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  const content = withKeyboard ? (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.background }, style]} edges={edges}>
      {header}
      {content}
    </SafeAreaView>
  );
}
