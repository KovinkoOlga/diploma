import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../theme/ThemeProvider";
import HomeStack from "./stacks/HomeStack";
import NewsStack from "./stacks/FeedStack";
import WardrobeStack from "./stacks/WardrobeStack";
import OutfitsStack from "./stacks/OutfitsStack";
import AccountStack from "./stacks/AccountStack";

const Tab = createBottomTabNavigator();

function tabIcon(name) {
  return ({ color, size, focused }) => (
    <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />
  );
}

export default function TabNavigator() {
  const { colors, typography, layout } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const tabBarHeight = layout.tabBarBaseHeight + bottomPadding;

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.active,
        tabBarInactiveTintColor: colors.inactive,
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.divider,
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: bottomPadding,
          },
        ],
        tabBarLabelStyle: {
          ...typography.tabLabel,
          marginTop: -2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: "Главная", tabBarIcon: tabIcon("home") }} />
      <Tab.Screen name="NewsTab" component={NewsStack} options={{ title: "Новости", tabBarIcon: tabIcon("search") }} />
      <Tab.Screen
        name="WardrobeTab"
        component={WardrobeStack}
        options={{ title: "Шкаф", tabBarIcon: tabIcon("grid") }}
      />
      <Tab.Screen
        name="OutfitsTab"
        component={OutfitsStack}
        options={{ title: "Образы", tabBarIcon: tabIcon("bookmark") }}
      />
      <Tab.Screen
        name="AccountTab"
        component={AccountStack}
        options={{ title: "Аккаунт", tabBarIcon: tabIcon("person") }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    shadowOpacity: 0,
  },
});
