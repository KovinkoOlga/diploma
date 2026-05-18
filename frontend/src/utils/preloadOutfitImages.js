import { Image } from "react-native";
import { resolveOutfitCoverItemImageSource } from "./outfitImageSource";

const DEFAULT_TIMEOUT_MS = 1200000000000;

function withTimeout(promise, timeoutMs, errorMessage) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function getUriFromSource(source) {
  if (!source || typeof source !== "object") return null;
  if (typeof source.uri !== "string") return null;
  const uri = source.uri.trim();
  return uri || null;
}

function isRemoteUri(uri) {
  return /^https?:\/\//i.test(uri);
}

function verifyRemoteImage(uri, timeoutMs) {
  const prefetch = withTimeout(
    Image.prefetch(uri).then((ok) => {
      if (!ok) throw new Error("prefetch_failed");
      return true;
    }),
    timeoutMs,
    "prefetch_timeout"
  );

  const size = withTimeout(
    new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        () => resolve(true),
        (error) => reject(error || new Error("get_size_failed"))
      );
    }),
    timeoutMs,
    "get_size_timeout"
  );

  return Promise.all([prefetch, size]);
}

async function preloadSingleOutfitItemImage(item, timeoutMs) {
  const source = resolveOutfitCoverItemImageSource(item);

  if (!source) {
    return {
      ok: false,
      itemId: item?.id ?? null,
      title: item?.title ?? null,
      reason: "missing_source",
    };
  }

  if (typeof source === "number") {
    return { ok: true, itemId: item?.id ?? null };
  }

  const uri = getUriFromSource(source);
  if (!uri) {
    return {
      ok: false,
      itemId: item?.id ?? null,
      title: item?.title ?? null,
      reason: "invalid_source",
    };
  }

  if (!isRemoteUri(uri)) {
    return { ok: true, itemId: item?.id ?? null };
  }

  try {
    await verifyRemoteImage(uri, timeoutMs);
    return { ok: true, itemId: item?.id ?? null };
  } catch (error) {
    return {
      ok: false,
      itemId: item?.id ?? null,
      title: item?.title ?? null,
      uri,
      reason: error?.message || "image_unavailable",
    };
  }
}

export async function preloadOutfitCoverImages(items, options = {}) {
  const timeoutMs =
    // Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    //   ? options.timeoutMs
    //   :
       DEFAULT_TIMEOUT_MS;
  const sourceItems = Array.isArray(items) ? items.filter(Boolean) : [];

  if (!sourceItems.length) {
    return { failedItems: [] };
  }

  const results = await Promise.all(
    sourceItems.map((item) => preloadSingleOutfitItemImage(item, timeoutMs))
  );
  const failedItems = results.filter((entry) => !entry.ok);

  return { failedItems };
}
