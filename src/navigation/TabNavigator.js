import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../theme/ThemeProvider";
import HomeStack from "./stacks/HomeStack";
import WardrobeStack from "./stacks/WardrobeStack";
import OutfitsStack from "./stacks/OutfitsStack";
import AccountStack from "./stacks/AccountStack";
import FeedStack from "./stacks/FeedStack";

const Tab = createBottomTabNavigator();

function tabIcon(name) {
  return ({ color, size, focused }) => (
    <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />
  );
}

export default function TabNavigator() {
  const theme = useAppTheme();
  const { colors, radius, shadows, typography } = theme;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarStyle: [
          styles.tabBar,
          {
            borderRadius: radius.lg,
            backgroundColor: colors.tabBar,
            borderColor: colors.border,
            ...shadows.tabBar,
          },
        ],
        tabBarLabelStyle: {
          ...typography.small,
          marginBottom: 2,
          letterSpacing: 0.4,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ title: "Главная", tabBarIcon: tabIcon("home") }}
      />
      <Tab.Screen
        name="WardrobeTab"
        component={WardrobeStack}
        options={{ title: "Шкаф", tabBarIcon: tabIcon("shirt") }}
      />
      <Tab.Screen
        name="OutfitsTab"
        component={OutfitsStack}
        options={{ title: "Образы", tabBarIcon: tabIcon("sparkles") }}
      />
      <Tab.Screen
        name="AccountTab"
        component={AccountStack}
        options={{ title: "Аккаунт", tabBarIcon: tabIcon("person") }}
      />
      <Tab.Screen
        name="FeedTab"
        component={FeedStack}
        options={{ title: "Лента", tabBarIcon: tabIcon("search") }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 12,
    borderTopWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

