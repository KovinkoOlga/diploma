import React, { useLayoutEffect } from "react";
import WardrobeCollectionView from "../../components/WardrobeCollectionView";
import { useWardrobe } from "../../store/WardrobeStore";

export default function WardrobeArchiveScreen({ navigation }) {
  const { items, catalogs, categories, outfits, actions } = useWardrobe();

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Архив" });
  }, [navigation]);

  return (
    <WardrobeCollectionView
      navigation={navigation}
      items={items}
      catalogs={catalogs}
      categories={categories}
      outfits={outfits}
      actions={actions}
      title="Архив"
      subtitle="Скрытые вещи не мешают основному шкафу"
      emptyStateTitle="Архив пока пуст"
      emptyStateSubtitle="Перенесите сюда вещи, которые не нужны в основном потоке"
      fixedFilters={{ status: ["archived"] }}
      archiveMode
    />
  );
}
