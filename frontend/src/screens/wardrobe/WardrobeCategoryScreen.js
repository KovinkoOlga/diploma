import React, { useLayoutEffect } from "react";
import WardrobeCollectionView from "../../components/WardrobeCollectionView";
import { useWardrobe } from "../../store/WardrobeStore";

export default function WardrobeCategoryScreen({ navigation, route }) {
  const { items, catalogs, categories, colorOptions, outfits, actions } = useWardrobe();
  const category = categories.find((entry) => entry.id === route.params?.categoryId) ?? categories[0];
  const catalog = catalogs.find((entry) => entry.id === route.params?.catalogId) ?? catalogs[0];

  useLayoutEffect(() => {
    navigation.setOptions({ title: category?.title ?? "Категория" });
  }, [category?.title, navigation]);

  return (
    <WardrobeCollectionView
      navigation={navigation}
      items={items}
      catalogs={catalogs}
      categories={categories}
      colorOptions={colorOptions}
      outfits={outfits}
      actions={actions}
      title={category?.title ?? "Категория"}
      subtitle={`Каталог ${catalog?.title ?? "Основное"}`}
      emptyStateTitle={`В категории “${category?.title ?? "Категория"}” пока ничего нет`}
      emptyStateSubtitle="Попробуйте изменить фильтры или добавить новую вещь"
      fixedFilters={{ catalogId: [catalog?.id], categoryId: [category?.id] }}
      initialQuery={route.params?.initialQuery ?? ""}
      initialFilters={route.params?.initialFilters}
      initialSortBy={route.params?.initialSortBy ?? "recent"}
      allowCatalogFilter={false}
      allowCategoryFilter={false}
    />
  );
}
