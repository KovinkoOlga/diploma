const IMAGE_SOURCE_FIELDS = [
  "image",
  "imageUrl",
  "transparentImage",
  "transparentImageUrl",
  "processedImage",
  "processedImageUrl",
  "cutoutImage",
  "cutoutImageUrl",
  "previewImage",
  "previewImageUrl",
  "catalogImage",
  "catalogImageUrl",
  "photo",
  "photoUrl",
];

export function normalizeImageSource(source) {
  if (!source) return null;

  if (typeof source === "number") return source;

  if (typeof source === "string") {
    const uri = source.trim();
    return uri ? { uri } : null;
  }

  if (typeof source === "object") {
    if (typeof source.uri === "string" && source.uri.trim()) {
      return { ...source, uri: source.uri.trim() };
    }
    if (typeof source.url === "string" && source.url.trim()) {
      return { uri: source.url.trim() };
    }
    if (typeof source.imageUrl === "string" && source.imageUrl.trim()) {
      return { uri: source.imageUrl.trim() };
    }
    if (source.source) {
      return normalizeImageSource(source.source);
    }
  }

  return null;
}

export function resolveOutfitCoverItemImageSource(item) {
  if (!item || typeof item !== "object") return null;

  for (const field of IMAGE_SOURCE_FIELDS) {
    const resolved = normalizeImageSource(item[field]);
    if (resolved) return resolved;
  }

  if (Array.isArray(item.media)) {
    for (const media of item.media) {
      const resolved =
        normalizeImageSource(media?.image) ??
        normalizeImageSource(media?.imageUrl) ??
        normalizeImageSource(media?.uri) ??
        normalizeImageSource(media?.url);
      if (resolved) return resolved;
    }
  }

  return null;
}
