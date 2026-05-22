import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import * as wardrobeApi from "../api/wardrobe";
import * as outfitsApi from "../api/outfits";
import * as contentApi from "../api/content";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WardrobeContext = createContext(null);

function animate() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function fallbackPatchValue(patch, item) {
  return typeof patch === "function" ? patch(item) : patch;
}

export function WardrobeProvider({ children }) {
  const [items, setItems] = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [colorOptions, setColorOptions] = useState([]);
  const [seasonOptions, setSeasonOptions] = useState([]);
  const [styleOptions, setStyleOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [dictionarySubcategories, setDictionarySubcategories] = useState([]);
  const [dictionaryStyles, setDictionaryStyles] = useState([]);
  const [dictionaryBrands, setDictionaryBrands] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [outfitDraftSessions, setOutfitDraftSessions] = useState({});
  const [feedPosts, setFeedPosts] = useState([]);
  const [homeContent, setHomeContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshBootstrap = useCallback(async () => {
    const bootstrap = await wardrobeApi.fetchBootstrap();
    setCatalogs(bootstrap.catalogs ?? []);
    setCategories(bootstrap.categories ?? []);
    setColorOptions(bootstrap.colorOptions ?? []);
    setSeasonOptions(bootstrap.seasons ?? []);
    setStyleOptions(bootstrap.styles ?? []);
    setStatusOptions(bootstrap.statuses ?? []);
    setTemplates(bootstrap.templates ?? []);
    return bootstrap;
  }, []);

  const refreshDictionaries = useCallback(async () => {
    const dictionaries = await wardrobeApi.fetchDictionaries();
    setDictionarySubcategories(dictionaries.subcategories ?? []);
    setDictionaryStyles(dictionaries.styles ?? []);
    setDictionaryBrands(dictionaries.brands ?? []);
    return dictionaries;
  }, []);

  const refreshItems = useCallback(async (filters = {}) => {
    const nextItems = await wardrobeApi.fetchItems({ includeArchived: true, ...filters });
    animate();
    setItems(nextItems);
    return nextItems;
  }, []);

  const refreshOutfits = useCallback(async () => {
    const nextOutfits = await outfitsApi.fetchOutfits();
    setOutfits(nextOutfits ?? []);
    return nextOutfits;
  }, []);

  const refreshContent = useCallback(async () => {
    const [nextFeed, nextHome] = await Promise.all([contentApi.fetchFeed(), contentApi.fetchHomeContent()]);
    setFeedPosts(nextFeed ?? []);
    setHomeContent(nextHome ?? null);
    return { feedPosts: nextFeed, homeContent: nextHome };
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await refreshBootstrap();
      await refreshDictionaries();
      await refreshItems();
      await refreshOutfits();
      await refreshContent();
    } catch (requestError) {
      setError(requestError.message || "Не удалось загрузить шкаф");
    } finally {
      setLoading(false);
    }
  }, [refreshBootstrap, refreshContent, refreshDictionaries, refreshItems, refreshOutfits]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const actions = useMemo(
    () => ({
      refreshAll,
      refreshBootstrap,
      refreshDictionaries,
      refreshItems,
      refreshOutfits,
      refreshContent,
      async addItem(draft) {
        const saved = await wardrobeApi.createItem(draft);
        animate();
        setItems((prev) => [saved, ...prev]);
        await Promise.all([refreshBootstrap(), refreshDictionaries()]);
        return saved;
      },
      async updateItem(itemId, patch) {
        const current = items.find((item) => item.id === itemId);
        const saved = await wardrobeApi.updateItem(itemId, fallbackPatchValue(patch, current));
        animate();
        setItems((prev) => prev.map((item) => (item.id === itemId ? saved : item)));
        await Promise.all([refreshBootstrap(), refreshDictionaries()]);
        return saved;
      },
      async deleteItem(itemId) {
        await wardrobeApi.deleteItem(itemId);
        animate();
        setItems((prev) => prev.filter((item) => item.id !== itemId));
        setOutfits((prev) =>
          prev.map((outfit) => ({
            ...outfit,
            itemIds: outfit.itemIds.filter((id) => id !== itemId),
            coverEditorStateJson:
              outfit.coverMode === "composition" && outfit.coverEditorStateJson?.objects
                ? {
                    ...outfit.coverEditorStateJson,
                    objects: outfit.coverEditorStateJson.objects.filter((entry) => entry.itemId !== itemId),
                  }
                : outfit.coverEditorStateJson,
          }))
        );
      },
      async bulkDeleteItems(itemIds) {
        const ids = new Set(itemIds);
        await wardrobeApi.bulkDeleteItems(itemIds);
        animate();
        setItems((prev) => prev.filter((item) => !ids.has(item.id)));
        await refreshOutfits();
      },
      async archiveItem(itemId) {
        const saved = await wardrobeApi.updateItem(itemId, { status: "archived" });
        animate();
        setItems((prev) => prev.map((item) => (item.id === itemId ? saved : item)));
        return saved;
      },
      async restoreItem(itemId) {
        const saved = await wardrobeApi.updateItem(itemId, { status: "active" });
        animate();
        setItems((prev) => prev.map((item) => (item.id === itemId ? saved : item)));
        return saved;
      },
      async bulkUpdateItems(itemIds, patch) {
        const savedItems = await wardrobeApi.bulkUpdateItems(itemIds, patch);
        const savedById = Object.fromEntries(savedItems.map((item) => [item.id, item]));
        animate();
        setItems((prev) => prev.map((item) => savedById[item.id] ?? item));
        await Promise.all([refreshBootstrap(), refreshDictionaries()]);
      },
      async addCatalog(title) {
        const catalog = await wardrobeApi.createCatalog(title.trim());
        animate();
        setCatalogs((prev) => [...prev, catalog]);
        return catalog;
      },
      async updateCatalog(catalogId, patch) {
        const catalog = await wardrobeApi.updateCatalog(catalogId, patch.title);
        animate();
        setCatalogs((prev) => prev.map((entry) => (entry.id === catalogId ? catalog : entry)));
        return catalog;
      },
      async createDraft(payload) {
        return wardrobeApi.createDraft(payload);
      },
      async uploadDraftImage(payload) {
        return wardrobeApi.uploadDraftImage(payload);
      },
      async createDraftFromTemplate(templateId, catalogId) {
        return wardrobeApi.createDraftFromTemplate(templateId, catalogId);
      },
      async fetchDraft(draftId) {
        return wardrobeApi.fetchDraft(draftId);
      },
      async enhanceDraft(draftId) {
        return wardrobeApi.enhanceDraft(draftId);
      },
      async editDraftMask(draftId, payload) {
        return wardrobeApi.editDraftMask(draftId, payload);
      },
      async confirmDraft(draftId, draft) {
        const saved = await wardrobeApi.confirmDraft(draftId, draft);
        animate();
        setItems((prev) => [saved, ...prev]);
        await Promise.all([refreshBootstrap(), refreshDictionaries()]);
        return saved;
      },
      async renameSubcategory(subcategoryId, name) {
        const entry = await wardrobeApi.updateSubcategory(subcategoryId, name.trim());
        await Promise.all([refreshBootstrap(), refreshDictionaries(), refreshItems()]);
        return entry;
      },
      async deleteSubcategory(subcategoryId) {
        await wardrobeApi.deleteSubcategory(subcategoryId);
        await Promise.all([refreshBootstrap(), refreshDictionaries(), refreshItems()]);
      },
      async renameStyle(styleId, name) {
        const entry = await wardrobeApi.updateStyle(styleId, name.trim());
        await Promise.all([refreshBootstrap(), refreshDictionaries(), refreshItems()]);
        return entry;
      },
      async deleteStyle(styleId) {
        await wardrobeApi.deleteStyle(styleId);
        await Promise.all([refreshBootstrap(), refreshDictionaries(), refreshItems()]);
      },
      async renameBrand(brandId, name) {
        const entry = await wardrobeApi.updateBrand(brandId, name.trim());
        await Promise.all([refreshBootstrap(), refreshDictionaries(), refreshItems()]);
        return entry;
      },
      async deleteBrand(brandId) {
        await wardrobeApi.deleteBrand(brandId);
        await Promise.all([refreshBootstrap(), refreshDictionaries(), refreshItems()]);
      },
      async upsertOutfit(outfitDraft) {
        const saved = outfitDraft.id
          ? await outfitsApi.updateOutfit(outfitDraft.id, {
              title: outfitDraft.title,
              itemIds: outfitDraft.itemIds,
              tags: outfitDraft.tags,
              season: outfitDraft.season,
              description: outfitDraft.description ?? "",
              coverMode: outfitDraft.coverMode ?? "none",
              coverFileId: outfitDraft.coverFileId ?? null,
              coverEditorStateJson: outfitDraft.coverEditorStateJson ?? null,
            })
          : await outfitsApi.createOutfit({
              title: outfitDraft.title,
              itemIds: outfitDraft.itemIds,
              tags: outfitDraft.tags,
              season: outfitDraft.season,
              description: outfitDraft.description ?? "",
              coverMode: outfitDraft.coverMode ?? "none",
              coverFileId: outfitDraft.coverFileId ?? null,
              coverEditorStateJson: outfitDraft.coverEditorStateJson ?? null,
            });
        animate();
        setOutfits((prev) => {
          const index = prev.findIndex((outfit) => outfit.id === saved.id);
          if (index === -1) return [saved, ...prev];
          const copy = prev.slice();
          copy[index] = saved;
          return copy;
        });
        return saved;
      },
      async deleteOutfit(outfitId) {
        await outfitsApi.deleteOutfit(outfitId);
        animate();
        setOutfits((prev) => prev.filter((outfit) => outfit.id !== outfitId));
      },
      async uploadOutfitCover(payload) {
        return outfitsApi.uploadOutfitCover(payload);
      },
      createOutfitDraftSession(initialDraft = {}) {
        const sessionId = `outfit_draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setOutfitDraftSessions((prev) => ({ ...prev, [sessionId]: initialDraft }));
        return sessionId;
      },
      updateOutfitDraftSession(sessionId, patch) {
        if (!sessionId) return;
        setOutfitDraftSessions((prev) => {
          const current = prev[sessionId] ?? {};
          const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
          return { ...prev, [sessionId]: next };
        });
      },
      clearOutfitDraftSession(sessionId) {
        if (!sessionId) return;
        setOutfitDraftSessions((prev) => {
          if (!(sessionId in prev)) return prev;
          const copy = { ...prev };
          delete copy[sessionId];
          return copy;
        });
      },
      async togglePostSaved(postId) {
        const result = await contentApi.toggleFeedSaved(postId);
        setFeedPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, saved: result.saved } : post)));
      },
    }),
    [items, refreshAll, refreshBootstrap, refreshContent, refreshDictionaries, refreshItems, refreshOutfits]
  );

  const value = useMemo(
    () => ({
      items,
      catalogs,
      categories,
      colorOptions,
      seasonOptions,
      styleOptions,
      statusOptions,
      dictionarySubcategories,
      dictionaryStyles,
      dictionaryBrands,
      templates,
      outfits,
      outfitDraftSessions,
      feedPosts,
      homeContent,
      loading,
      error,
      actions,
    }),
    [
      actions,
      catalogs,
      categories,
      colorOptions,
      dictionaryBrands,
      dictionaryStyles,
      dictionarySubcategories,
      error,
      feedPosts,
      homeContent,
      items,
      loading,
      outfitDraftSessions,
      outfits,
      seasonOptions,
      statusOptions,
      styleOptions,
      templates,
    ]
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
