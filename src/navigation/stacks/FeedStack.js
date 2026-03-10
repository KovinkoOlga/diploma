import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Routes } from "../routes";
import FeedHomeScreen from "../../screens/feed/FeedHomeScreen";
import PostDetailsScreen from "../../screens/feed/PostDetailsScreen";
import { useAppTheme } from "../../theme/ThemeProvider";

const Stack = createNativeStackNavigator();

export default function NewsStack() {
  const theme = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTitleStyle: { ...theme.typography.headerTitle, color: theme.colors.text },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        headerTitleAlign: "center",
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name={Routes.NewsHome} component={FeedHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name={Routes.PostDetails} component={PostDetailsScreen} options={{ title: "Публикация" }} />
    </Stack.Navigator>
  );
}
