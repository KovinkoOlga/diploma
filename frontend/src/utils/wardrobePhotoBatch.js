export const PHOTO_BATCH_MAX_SELECTION = 100;
export const PHOTO_BATCH_UPLOAD_CONCURRENCY = 2;

export const PHOTO_BATCH_UPLOAD_STATUS = {
  pending: "pending",
  uploading: "uploading",
  uploaded: "uploaded",
  failed: "failed",
  skipped: "skipped",
};

function createLocalId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createPhotoBatch({ assets, catalogId, sourceType = "gallery" }) {
  const entries = (assets ?? []).map((asset, index) => ({
    id: createLocalId("photo_batch_entry"),
    order: index,
    asset,
    draftId: null,
    uploadStatus: PHOTO_BATCH_UPLOAD_STATUS.pending,
    processingStatus: null,
    error: "",
    draft: null,
    draftState: null,
    savedItemId: null,
  }));

  return {
    batchId: createLocalId("photo_batch"),
    sourceType,
    catalogId,
    currentIndex: 0,
    total: entries.length,
    entries,
  };
}

function updateBatchEntry(batch, entryId, updater) {
  if (!batch) return batch;
  return {
    ...batch,
    entries: batch.entries.map((entry) => (entry.id === entryId ? updater(entry) : entry)),
  };
}

export function photoBatchReducer(state, action) {
  switch (action.type) {
    case "batch_created":
      return action.batch;
    case "batch_cleared":
      if (action.batchId && state?.batchId !== action.batchId) {
        return state;
      }
      return null;
    case "entry_upload_started":
      if (state?.batchId !== action.batchId) return state;
      return updateBatchEntry(state, action.entryId, (entry) => ({
        ...entry,
        uploadStatus: PHOTO_BATCH_UPLOAD_STATUS.uploading,
        processingStatus: null,
        error: "",
        draft: null,
        draftId: null,
        draftState: null,
      }));
    case "entry_upload_succeeded":
      if (state?.batchId !== action.batchId) return state;
      return updateBatchEntry(state, action.entryId, (entry) => ({
        ...entry,
        draftId: action.draft.id,
        uploadStatus: PHOTO_BATCH_UPLOAD_STATUS.uploaded,
        processingStatus: action.draft.processingStatus ?? entry.processingStatus,
        error: action.draft.errorMessage || "",
        draft: action.draft.draft ?? entry.draft,
        draftState: action.draft,
      }));
    case "entry_upload_failed":
      if (state?.batchId !== action.batchId) return state;
      return updateBatchEntry(state, action.entryId, (entry) => ({
        ...entry,
        uploadStatus: PHOTO_BATCH_UPLOAD_STATUS.failed,
        processingStatus: entry.draftId ? entry.processingStatus : null,
        error: action.error,
      }));
    case "entry_draft_synced":
      if (state?.batchId !== action.batchId) return state;
      return updateBatchEntry(state, action.entryId, (entry) => ({
        ...entry,
        draftId: entry.draftId ?? action.draftState.id ?? null,
        processingStatus: action.draftState.processingStatus ?? entry.processingStatus,
        error:
          action.draftState.processingStatus === "failed"
            ? action.draftState.errorMessage || "Не удалось обработать изображение"
            : "",
        draft: action.draftState.draft ?? entry.draft,
        draftState: action.draftState,
      }));
    case "entry_retry_requested":
      if (state?.batchId !== action.batchId) return state;
      return updateBatchEntry(state, action.entryId, (entry) => ({
        ...entry,
        draftId: null,
        uploadStatus: PHOTO_BATCH_UPLOAD_STATUS.pending,
        processingStatus: null,
        error: "",
        draft: null,
        draftState: null,
        savedItemId: null,
      }));
    case "entry_skipped":
      if (state?.batchId !== action.batchId) return state;
      return updateBatchEntry(state, action.entryId, (entry) => ({
        ...entry,
        uploadStatus: PHOTO_BATCH_UPLOAD_STATUS.skipped,
        error: "",
      }));
    case "entry_saved":
      if (state?.batchId !== action.batchId) return state;
      return updateBatchEntry(state, action.entryId, (entry) => ({
        ...entry,
        savedItemId: action.itemId,
        error: "",
      }));
    case "current_index_set":
      if (state?.batchId !== action.batchId) return state;
      return {
        ...state,
        currentIndex: action.index,
      };
    default:
      return state;
  }
}

export function getPhotoBatchEntry(batch, entryId) {
  if (!batch || !entryId) return null;
  return batch.entries.find((entry) => entry.id === entryId) ?? null;
}

export function getPhotoBatchCurrentEntry(batch) {
  if (!batch) return null;
  return batch.entries[batch.currentIndex] ?? null;
}

export function isPhotoBatchEntryReady(entry) {
  return Boolean(entry?.draftId && entry?.processingStatus === "ready" && entry?.draft);
}

export function isPhotoBatchEntryFailed(entry) {
  return Boolean(entry && (entry.uploadStatus === PHOTO_BATCH_UPLOAD_STATUS.failed || entry.processingStatus === "failed"));
}

export function isPhotoBatchEntryWaitingForUpload(entry) {
  return Boolean(
    entry &&
      !entry.draftId &&
      (entry.uploadStatus === PHOTO_BATCH_UPLOAD_STATUS.pending || entry.uploadStatus === PHOTO_BATCH_UPLOAD_STATUS.uploading)
  );
}

export function getPhotoBatchProgress(batch, entryId = null) {
  if (!batch) return null;
  const index = entryId ? batch.entries.findIndex((entry) => entry.id === entryId) : batch.currentIndex;
  const safeIndex = index >= 0 ? index : batch.currentIndex;
  return {
    current: safeIndex + 1,
    total: batch.total,
    label: `Фото ${safeIndex + 1} из ${batch.total}`,
  };
}

export function findNextPhotoBatchIndex(batch, startIndex = 0) {
  if (!batch) return -1;
  for (let index = startIndex; index < batch.entries.length; index += 1) {
    const entry = batch.entries[index];
    if (entry.savedItemId) continue;
    if (entry.uploadStatus === PHOTO_BATCH_UPLOAD_STATUS.skipped) continue;
    return index;
  }
  return -1;
}

export function getLastSavedPhotoBatchItemId(batch) {
  if (!batch) return null;
  for (let index = batch.entries.length - 1; index >= 0; index -= 1) {
    const itemId = batch.entries[index]?.savedItemId;
    if (itemId) return itemId;
  }
  return null;
}
