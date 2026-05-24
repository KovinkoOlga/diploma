import React from "react";
import { View } from "react-native";
import WardrobeItemCard from "./WardrobeItemCard";

export default function CalendarItemsGrid({ items = [], categoriesById = {}, onPressItem, spacing = 12 }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing / 2 }}>
      {items.map((item) => (
        <View key={item.id} style={{ width: "50%", paddingHorizontal: spacing / 2, marginBottom: spacing }}>
          <WardrobeItemCard
            item={item}
            category={categoriesById[item.categoryId]}
            onPress={() => onPressItem?.(item)}
          />
        </View>
      ))}
    </View>
  );
}
