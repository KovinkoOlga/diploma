import React, { createContext, useContext, useMemo, useState } from "react";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import { initialItems } from "../data/items";
import { initialOutfits } from "../data/outfits";
import { initialFeedPosts } from "../data/feed";
import { initialCatalogs } from "../data/catalogs";
import { wardrobeCategories } from "../data/categories";
import { wardrobeTemplates } from "../data/wardrobeTemplates";
import { createId } from "../utils/id";
import { normalizeWardrobeItemDraft } from "../utils/wardrobe";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WardrobeContext = createContext(null);

function animate() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

export function WardrobeProvider({ children }) {
  const [items, setItems] = useState(initialItems);
  const [catalogs, setCatalogs] = useState(initialCatalogs);
  const [categories, setCategories] = useState(wardrobeCategories);
  const [outfits, setOutfits] = useState(initialOutfits);
  const [feedPosts, setFeedPosts] = useState(initialFeedPosts);

  const actions = useMemo(() => {
    const updateItem = (itemId, patch) => {
      let updatedItem = null;

      animate();
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          updatedItem = normalizeWardrobeItemDraft(typeof patch === "function" ? patch(item) : patch, item);
          return updatedItem;
        })
      );

      return updatedItem;
    };

    return {
      addItem(draft) {
        const next = normalizeWardrobeItemDraft(
          {
            id: createId("item"),
            ...draft,
          },
          null
        );

        animate();
        setItems((prev) => [next, ...prev]);
        return next;
      },
      updateItem,
      deleteItem(itemId) {
        animate();
        setItems((prev) => prev.filter((item) => item.id !== itemId));
        setOutfits((prev) =>
          prev.map((outfit) => ({
            ...outfit,
            itemIds: outfit.itemIds.filter((id) => id !== itemId),
          }))
        );
      },
      bulkDeleteItems(itemIds) {
        const ids = new Set(itemIds);
        animate();
        setItems((prev) => prev.filter((item) => !ids.has(item.id)));
        setOutfits((prev) =>
          prev.map((outfit) => ({
            ...outfit,
            itemIds: outfit.itemIds.filter((id) => !ids.has(id)),
          }))
        );
      },
      archiveItem(itemId) {
        return updateItem(itemId, { status: "archived", isArchived: true });
      },
      restoreItem(itemId) {
        return updateItem(itemId, { status: "active", isArchived: false });
      },
      bulkUpdateItems(itemIds, patch) {
        const ids = new Set(itemIds);
        animate();
        setItems((prev) =>
          prev.map((item) => {
            if (!ids.has(item.id)) return item;
            return normalizeWardrobeItemDraft(typeof patch === "function" ? patch(item) : patch, item);
          })
        );
      },
      addCatalog(title) {
        const nextCatalog = {
          id: createId("catalog"),
          title: title.trim(),
          description: "",
        };
        animate();
        setCatalogs((prev) => [...prev, nextCatalog]);
        return nextCatalog;
      },
      updateCatalog(catalogId, patch) {
        animate();
        setCatalogs((prev) =>
          prev.map((catalog) => (catalog.id === catalogId ? { ...catalog, ...patch } : catalog))
        );
      },
      addCategory(payload) {
        const nextCategory = {
          id: createId("category"),
          icon: "pricetag-outline",
          subcategories: [],
          ...payload,
        };
        animate();
        setCategories((prev) => [...prev, nextCategory]);
        return nextCategory;
      },
      updateCategory(categoryId, patch) {
        animate();
        setCategories((prev) =>
          prev.map((category) => (category.id === categoryId ? { ...category, ...patch } : category))
        );
      },
      upsertOutfit(outfitDraft) {
        animate();
        setOutfits((prev) => {
          const index = prev.findIndex((outfit) => outfit.id === outfitDraft.id);

          if (index === -1) {
            return [{ ...outfitDraft, id: createId("outfit") }, ...prev];
          }

          const copy = prev.slice();
          copy[index] = outfitDraft;
          return copy;
        });
      },
      togglePostSaved(postId) {
        setFeedPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, saved: !post.saved } : post)));
      },
    };
  }, []);

  const value = useMemo(
    () => ({
      items,
      catalogs,
      categories,
      templates: wardrobeTemplates,
      outfits,
      feedPosts,
      actions,
    }),
    [actions, catalogs, categories, feedPosts, items, outfits]
  );

  return <WardrobeContext.Provider value={value}>{children}</WardrobeContext.Provider>;
}

export function useWardrobe() {
  const context = useContext(WardrobeContext);

  if (!context) {
    throw new Error("useWardrobe must be used within WardrobeProvider");
  }

  return context;
}
