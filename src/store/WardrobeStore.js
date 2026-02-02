import React, { createContext, useContext, useMemo, useState } from "react";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import { initialItems } from "../data/items";
import { initialOutfits } from "../data/outfits";
import { initialFeedPosts } from "../data/feed";
import { createId } from "../utils/id";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WardrobeContext = createContext(null);

export function WardrobeProvider({ children }) {
  const [items, setItems] = useState(initialItems);
  const [outfits, setOutfits] = useState(initialOutfits);
  const [feedPosts, setFeedPosts] = useState(initialFeedPosts);

  const actions = useMemo(
    () => ({
      addItem(draft) {
        const next = {
          id: createId("item"),
          wearCount: 0,
          ...draft,
        };
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setItems((prev) => [next, ...prev]);
        return next;
      },
      deleteItem(itemId) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setOutfits((prev) =>
          prev.map((o) => ({ ...o, itemIds: o.itemIds.filter((id) => id !== itemId) }))
        );
      },
      upsertOutfit(outfitDraft) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOutfits((prev) => {
          const idx = prev.findIndex((o) => o.id === outfitDraft.id);
          if (idx === -1) return [{ ...outfitDraft, id: createId("outfit") }, ...prev];
          const copy = prev.slice();
          copy[idx] = outfitDraft;
          return copy;
        });
      },
      togglePostSaved(postId) {
        setFeedPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, saved: !p.saved } : p))
        );
      },
    }),
    []
  );

  const value = useMemo(
    () => ({
      items,
      outfits,
      feedPosts,
      actions,
    }),
    [items, outfits, feedPosts, actions]
  );

  return <WardrobeContext.Provider value={value}>{children}</WardrobeContext.Provider>;
}

export function useWardrobe() {
  const ctx = useContext(WardrobeContext);
  if (!ctx) throw new Error("useWardrobe must be used within WardrobeProvider");
  return ctx;
}

