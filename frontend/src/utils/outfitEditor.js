import { Routes } from "../navigation/routes";
import {
  createBaseCoverEditorState,
  MIN_OUTFIT_ITEMS,
  OUTFIT_MIN_ITEMS_MESSAGE,
} from "./outfitCover";
import { preloadOutfitCoverImages } from "./preloadOutfitImages";

export { MIN_OUTFIT_ITEMS, OUTFIT_MIN_ITEMS_MESSAGE };

export async function openOutfitCoverEditor({
  navigation,
  actions,
  draftSessionId,
  draft,
  itemById,
}) {
  const selectedItemIds = (draft?.itemIds ?? []).filter(Boolean);
  if (selectedItemIds.length < MIN_OUTFIT_ITEMS) {
    throw new Error(OUTFIT_MIN_ITEMS_MESSAGE);
  }

  const selectedItems = selectedItemIds.map((itemId) => itemById[itemId]).filter(Boolean);
  const { failedItems } = await preloadOutfitCoverImages(selectedItems, { timeoutMs: 12000 });
  if (failedItems.length) {
    throw new Error("Не удалось подготовить изображения для обложки. Проверьте подключение и попробуйте снова.");
  }

  const coverState = createBaseCoverEditorState(selectedItemIds, itemById, draft?.coverEditorStateJson);
  actions.updateOutfitDraftSession(draftSessionId, {
    coverMode: "composition",
    coverEditorStateJson: coverState,
  });
  navigation.navigate(Routes.OutfitCoverEditor, { draftSessionId });
}
