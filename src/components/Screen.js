import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../theme/ThemeProvider";

export default function Screen({ children, style }) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: colors.bg }, style]} edges={["top", "left", "right"]}>
      {children}
    </SafeAreaView>
  );
}

