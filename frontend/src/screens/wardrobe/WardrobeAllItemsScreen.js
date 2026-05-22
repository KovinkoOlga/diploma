import React, { useLayoutEffect } from "react";
import WardrobeCollectionView from "../../components/WardrobeCollectionView";
import { useWardrobe } from "../../store/WardrobeStore";

export default function WardrobeAllItemsScreen({ navigation, route }) {
  const { items, catalogs, categories, colorOptions, seasonOptions, styleOptions, statusOptions, outfits, actions } = useWardrobe();
  const catalog = catalogs.find((entry) => entry.id === route.params?.catalogId) ?? catalogs[0];

  useLayoutEffect(() => {
    navigation.setOptions({ title: `${catalog?.title ?? "Каталог"} · Все вещи` });
  }, [catalog?.title, navigation]);

  return (
    <WardrobeCollectionView
      navigation={navigation}
      items={items}
      catalogs={catalogs}
      categories={categories}
      colorOptions={colorOptions}
      seasonOptions={seasonOptions}
      styleOptions={styleOptions}
      statusOptions={statusOptions}
      outfits={outfits}
      actions={actions}
      title="Все вещи"
      subtitle={`Каталог: ${catalog?.title ?? "Основное"}`}
      emptyStateTitle="В этом каталоге пока нет вещей"
      emptyStateSubtitle="Добавьте новую вещь, чтобы увидеть ее в общей сетке"
      fixedFilters={{ catalogId: [catalog?.id] }}
      initialSelectionMode={Boolean(route.params?.selectionMode)}
      initialQuery={route.params?.initialQuery ?? ""}
      initialFilters={route.params?.initialFilters}
      initialSortBy={route.params?.initialSortBy ?? "recent"}
      allowCatalogFilter={false}
    />
  );
}
