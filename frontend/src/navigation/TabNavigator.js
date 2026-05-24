import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../theme/ThemeProvider";
import { Routes } from "./routes";
import HomeStack from "./stacks/HomeStack";
import WardrobeStack from "./stacks/WardrobeStack";
import OutfitsStack from "./stacks/OutfitsStack";
import AccountStack from "./stacks/AccountStack";

const Tab = createBottomTabNavigator();

function tabIcon(name) {
  return ({ color, size, focused }) => (
    <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />
  );
}

function getTabRoute(state, tabName) {
  return state.routes.find((route) => route.name === tabName) ?? null;
}

function getActiveNestedRoute(tabRoute) {
  const nestedState = tabRoute?.state;
  if (!nestedState?.routes?.length) return null;
  return nestedState.routes[nestedState.index ?? nestedState.routes.length - 1] ?? null;
}

function resetTabStackToRoute(navigation, tabName, rootRouteName) {
  const state = navigation.getState();
  const tabRoute = getTabRoute(state, tabName);
  const targetKey = tabRoute?.state?.key;

  if (targetKey) {
    navigation.dispatch({
      ...CommonActions.reset({
        index: 0,
        routes: [{ name: rootRouteName }],
      }),
      target: targetKey,
    });
  }

  navigation.navigate(tabName, { screen: rootRouteName });
}

function closeTemporarySelection(navigation, tabName, selectionRouteName, rootRouteName) {
  const state = navigation.getState();
  const tabRoute = getTabRoute(state, tabName);
  const activeNestedRoute = getActiveNestedRoute(tabRoute);
  if (activeNestedRoute?.name !== selectionRouteName) {
    return false;
  }

  resetTabStackToRoute(navigation, tabName, rootRouteName);
  return true;
}

function createTabListeners(tabName) {
  return ({ navigation, route }) => ({
    tabPress: (event) => {
      const closedOutfitSelect = closeTemporarySelection(
        navigation,
        "OutfitsTab",
        Routes.OutfitSelect,
        Routes.OutfitsHome
      );
      const closedWardrobeSelect = closeTemporarySelection(
        navigation,
        "WardrobeTab",
        Routes.WardrobeItemSelect,
        Routes.WardrobeHome
      );

      const state = navigation.getState();
      const isFocused = state.routes[state.index]?.name === route.name;

      if (closedOutfitSelect || closedWardrobeSelect) {
        event.preventDefault();
        navigation.navigate(tabName);
        return;
      }

      if (isFocused && (tabName === "HomeTab" || tabName === "OutfitsTab" || tabName === "WardrobeTab")) {
        event.preventDefault();
        const rootRouteName =
          tabName === "OutfitsTab"
            ? Routes.OutfitsHome
            : tabName === "WardrobeTab"
              ? Routes.WardrobeHome
              : Routes.Home;
        resetTabStackToRoute(navigation, tabName, rootRouteName);
      }
    },
  });
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
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ title: "Главная", tabBarIcon: tabIcon("home") }}
        listeners={createTabListeners("HomeTab")}
      />
      <Tab.Screen
        name="WardrobeTab"
        component={WardrobeStack}
        options={{ title: "Шкаф", tabBarIcon: tabIcon("grid") }}
        listeners={createTabListeners("WardrobeTab")}
      />
      <Tab.Screen
        name="OutfitsTab"
        component={OutfitsStack}
        options={{ title: "Образы", tabBarIcon: tabIcon("bookmark") }}
        listeners={createTabListeners("OutfitsTab")}
      />
      <Tab.Screen name="AccountTab" component={AccountStack} options={{ title: "Аккаунт", tabBarIcon: tabIcon("person") }} />
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
