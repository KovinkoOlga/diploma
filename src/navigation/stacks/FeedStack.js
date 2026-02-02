import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Routes } from "../routes";
import FeedHomeScreen from "../../screens/feed/FeedHomeScreen";
import PostDetailsScreen from "../../screens/feed/PostDetailsScreen";
import { useAppTheme } from "../../theme/ThemeProvider";

const Stack = createNativeStackNavigator();

export default function FeedStack() {
  const theme = useAppTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTitleStyle: {
          ...theme.typography.h3,
          color: theme.colors.text,
        },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Stack.Screen name={Routes.FeedHome} component={FeedHomeScreen} options={{ title: "Лента" }} />
      <Stack.Screen
        name={Routes.PostDetails}
        component={PostDetailsScreen}
        options={{ title: "Пост" }}
      />
    </Stack.Navigator>
  );
}
