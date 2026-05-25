import React, { useLayoutEffect, useMemo } from "react";
import WardrobeCollectionView from "../../components/WardrobeCollectionView";
import { useWardrobe } from "../../store/WardrobeStore";

export default function WardrobeUnusedItemsScreen({ navigation, route }) {
  const { items, catalogs, categories, colorOptions, seasonOptions, styleOptions, statusOptions, outfits, actions } = useWardrobe();
  const selectedIds = route.params?.itemIds ?? [];
  const periodLabel = route.params?.periodLabel ?? "";
  const allPeriodSelected = Boolean(route.params?.allPeriodSelected);

  const unusedItems = useMemo(() => {
    const ids = new Set(selectedIds);
    return items.filter((item) => ids.has(item.id));
  }, [items, selectedIds]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Давно не носили" });
  }, [navigation]);

  return (
    <WardrobeCollectionView
      navigation={navigation}
      items={unusedItems}
      catalogs={catalogs}
      categories={categories}
      colorOptions={colorOptions}
      seasonOptions={seasonOptions}
      styleOptions={styleOptions}
      statusOptions={statusOptions}
      outfits={outfits}
      actions={actions}
      title="Давно не носили"
      subtitle={
        periodLabel
          ? `${unusedItems.length} вещей ${allPeriodSelected ? "за всё время" : "в выбранном периоде"} · ${periodLabel}`
          : `${unusedItems.length} вещей без использования`
      }
      emptyStateTitle="Нет неиспользованных вещей"
      emptyStateSubtitle="В выбранном периоде все подходящие вещи уже отмечались в носке."
      allowSelection={false}
      showFab={false}
    />
  );
}
