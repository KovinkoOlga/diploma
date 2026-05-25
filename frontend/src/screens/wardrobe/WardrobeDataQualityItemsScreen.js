import React, { useLayoutEffect, useMemo } from "react";
import WardrobeCollectionView from "../../components/WardrobeCollectionView";
import { useWardrobe } from "../../store/WardrobeStore";

export default function WardrobeDataQualityItemsScreen({ navigation, route }) {
  const { items, catalogs, categories, colorOptions, seasonOptions, styleOptions, statusOptions, outfits, actions } = useWardrobe();
  const selectedIds = route.params?.itemIds ?? [];
  const periodLabel = route.params?.periodLabel ?? "";

  const qualityItems = useMemo(() => {
    const ids = new Set(selectedIds);
    return items.filter((item) => ids.has(item.id));
  }, [items, selectedIds]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Качество данных" });
  }, [navigation]);

  return (
    <WardrobeCollectionView
      navigation={navigation}
      items={qualityItems}
      catalogs={catalogs}
      categories={categories}
      colorOptions={colorOptions}
      seasonOptions={seasonOptions}
      styleOptions={styleOptions}
      statusOptions={statusOptions}
      outfits={outfits}
      actions={actions}
      title="Вещи в статистике"
      subtitle={periodLabel ? `${qualityItems.length} вещей · ${periodLabel}` : `${qualityItems.length} вещей`}
      emptyStateTitle="Нет вещей для этого периода"
      emptyStateSubtitle="В выбранной статистике сейчас нет вещей, попадающих в расчёт качества данных."
      allowSelection={false}
      showFab={false}
    />
  );
}
