import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Canvas, Circle, Group, Image as SkiaImage, Path, rect, useImage } from "@shopify/react-native-skia";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MediaPreview from "../../components/MediaPreview";
import Screen from "../../components/Screen";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAppTheme } from "../../theme/ThemeProvider";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const HISTORY_LIMIT = 50;
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const OVERLAY_RGB = [112, 92, 255];
const OVERLAY_ALPHA = 88;

const CRC_TABLE = (() => {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function decodeBase64(value = "") {
  const clean = value.replace(/=+$/, "");
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const index = BASE64_ALPHABET.indexOf(char);
    if (index < 0) continue;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }
  return new Uint8Array(bytes);
}

function encodeBase64(bytes) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const c = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const chunk = (a << 16) | (b << 8) | c;
    output += BASE64_ALPHABET[(chunk >> 18) & 63];
    output += BASE64_ALPHABET[(chunk >> 12) & 63];
    output += index + 1 < bytes.length ? BASE64_ALPHABET[(chunk >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? BASE64_ALPHABET[chunk & 63] : "=";
  }
  return output;
}

function asciiBytes(value) {
  return Uint8Array.from(Array.from(value).map((char) => char.charCodeAt(0)));
}

function createPgmUri(maskData, width, height) {
  const header = asciiBytes(`P5\n${width} ${height}\n255\n`);
  const payload = new Uint8Array(header.length + maskData.length);
  payload.set(header, 0);
  payload.set(maskData, header.length);
  return `data:image/x-portable-graymap;base64,${encodeBase64(payload)}`;
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 255;
  bytes[offset + 1] = (value >>> 16) & 255;
  bytes[offset + 2] = (value >>> 8) & 255;
  bytes[offset + 3] = value & 255;
}

function crc32(typeBytes, data) {
  let crc = 0xffffffff;
  for (const byte of typeBytes) {
    crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  }
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = asciiBytes(type);
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeUint32(chunk, 8 + data.length, crc32(typeBytes, data));
  return chunk;
}

function adler32(data) {
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function zlibStore(data) {
  const blocks = [];
  let offset = 0;
  while (offset < data.length) {
    const length = Math.min(65535, data.length - offset);
    const isFinal = offset + length >= data.length;
    const block = new Uint8Array(5 + length);
    block[0] = isFinal ? 1 : 0;
    block[1] = length & 255;
    block[2] = (length >>> 8) & 255;
    const nlen = (~length) & 65535;
    block[3] = nlen & 255;
    block[4] = (nlen >>> 8) & 255;
    block.set(data.subarray(offset, offset + length), 5);
    blocks.push(block);
    offset += length;
  }
  const payloadLength = 2 + blocks.reduce((sum, block) => sum + block.length, 0) + 4;
  const payload = new Uint8Array(payloadLength);
  payload[0] = 0x78;
  payload[1] = 0x01;
  let cursor = 2;
  for (const block of blocks) {
    payload.set(block, cursor);
    cursor += block.length;
  }
  writeUint32(payload, cursor, adler32(data));
  return payload;
}

function createOverlayPngUri(maskData, width, height) {
  const stride = width * 4 + 1;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * stride;
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const maskValue = maskData[y * width + x] ?? 0;
      const alpha = Math.round(((255 - maskValue) / 255) * OVERLAY_ALPHA);
      const pixelOffset = rowOffset + 1 + x * 4;
      raw[pixelOffset] = alpha > 0 ? OVERLAY_RGB[0] : 0;
      raw[pixelOffset + 1] = alpha > 0 ? OVERLAY_RGB[1] : 0;
      raw[pixelOffset + 2] = alpha > 0 ? OVERLAY_RGB[2] : 0;
      raw[pixelOffset + 3] = alpha;
    }
  }

  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, width);
  writeUint32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const chunks = [
    Uint8Array.from(PNG_SIGNATURE),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlibStore(raw)),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const png = new Uint8Array(totalLength);
  let cursor = 0;
  for (const chunk of chunks) {
    png.set(chunk, cursor);
    cursor += chunk.length;
  }
  return `data:image/png;base64,${encodeBase64(png)}`;
}

function distance(touches) {
  if (touches.length < 2) return 0;
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

function midpoint(touches) {
  if (touches.length < 2) return { x: 0, y: 0 };
  const [a, b] = touches;
  return {
    x: (a.pageX + b.pageX) / 2,
    y: (a.pageY + b.pageY) / 2,
  };
}

function fitRect(container, imageWidth, imageHeight) {
  if (!container.width || !container.height || !imageWidth || !imageHeight) {
    return { x: 0, y: 0, width: container.width || 1, height: container.height || 1 };
  }
  const containerRatio = container.width / container.height;
  const imageRatio = imageWidth / imageHeight;
  if (imageRatio > containerRatio) {
    const width = container.width;
    const height = width / imageRatio;
    return { x: 0, y: (container.height - height) / 2, width, height };
  }
  const height = container.height;
  const width = height * imageRatio;
  return { x: (container.width - width) / 2, y: 0, width, height };
}

function clampEditorOffset(value, container, contentRect, zoomValue) {
  if (zoomValue <= MIN_ZOOM || !container.width || !container.height || !contentRect.width || !contentRect.height) {
    return value.x === 0 && value.y === 0 ? value : { x: 0, y: 0 };
  }
  const maxX = Math.max(0, (contentRect.width * (zoomValue - 1)) / 2);
  const maxY = Math.max(0, (contentRect.height * (zoomValue - 1)) / 2);
  const next = {
    x: clamp(value.x, -maxX, maxX),
    y: clamp(value.y, -maxY, maxY),
  };
  return next.x === value.x && next.y === value.y ? value : next;
}

function createImagePreviewTransform(displayRect, zoomValue, offsetValue, flipHorizontalValue, rotationDegreesValue) {
  const origin = {
    x: displayRect.x + displayRect.width / 2,
    y: displayRect.y + displayRect.height / 2,
  };
  const radians = (rotationDegreesValue * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const safeZoom = zoomValue || 1;
  const flipScale = flipHorizontalValue ? -1 : 1;

  const normalizedToImageLocal = (point) => ({
    x: displayRect.x + point.x * displayRect.width,
    y: displayRect.y + point.y * displayRect.height,
  });

  const normalizedToPreview = (point) => {
    let dx = (point.x - 0.5) * displayRect.width;
    const dy = (point.y - 0.5) * displayRect.height;
    dx *= flipScale;
    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;
    return {
      x: origin.x + rotatedX * safeZoom + offsetValue.x,
      y: origin.y + rotatedY * safeZoom + offsetValue.y,
    };
  };

  const previewToNormalized = (point) => {
    if (!displayRect.width || !displayRect.height) return null;
    const dx = (point.x - origin.x - offsetValue.x) / safeZoom;
    const dy = (point.y - origin.y - offsetValue.y) / safeZoom;
    const rotatedX = dx * cos + dy * sin;
    const rotatedY = -dx * sin + dy * cos;
    const normalized = {
      x: (rotatedX * flipScale) / displayRect.width + 0.5,
      y: rotatedY / displayRect.height + 0.5,
    };
    if (normalized.x < 0 || normalized.x > 1 || normalized.y < 0 || normalized.y > 1) {
      return null;
    }
    return normalized;
  };

  return {
    origin,
    normalizedToImageLocal,
    normalizedToPreview,
    previewToNormalized,
    reactNativeTransform: [
      { translateX: offsetValue.x },
      { translateY: offsetValue.y },
      { scale: safeZoom },
      { rotate: `${rotationDegreesValue}deg` },
      { scaleX: flipScale },
    ],
    skiaTransform: [
      { translateX: offsetValue.x },
      { translateY: offsetValue.y },
      { scale: safeZoom },
      { rotate: radians },
      { scaleX: flipScale },
    ],
  };
}

function createFallbackMask(width = 192, height = 192) {
  return new Uint8Array(width * height).fill(0);
}

function drawCircle(mask, width, height, cx, cy, radius, value) {
  const minX = clamp(Math.floor(cx - radius), 0, width - 1);
  const maxX = clamp(Math.ceil(cx + radius), 0, width - 1);
  const minY = clamp(Math.floor(cy - radius), 0, height - 1);
  const maxY = clamp(Math.ceil(cy + radius), 0, height - 1);
  const feather = Math.max(1.5, radius * 0.22);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const distanceFromCenter = Math.hypot(dx, dy);
      if (distanceFromCenter <= radius) {
        const strength = clamp((radius - distanceFromCenter) / feather, 0, 1);
        const index = y * width + x;
        const current = mask[index];
        if (value === 255) {
          mask[index] = Math.max(current, Math.round(current + (255 - current) * strength));
        } else {
          mask[index] = Math.min(current, Math.round(current * (1 - strength)));
        }
      }
    }
  }
}

function drawLine(mask, width, height, from, to, brushSize, value) {
  const x1 = from.x * (width - 1);
  const y1 = from.y * (height - 1);
  const x2 = to.x * (width - 1);
  const y2 = to.y * (height - 1);
  const distancePx = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  const steps = Math.ceil(distancePx / Math.max(1, brushSize / 3));
  const radius = Math.max(1, brushSize / 2);
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    drawCircle(mask, width, height, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, radius, value);
  }
}

function applyStrokesToMask(initialMask, width, height, strokes) {
  const next = new Uint8Array(initialMask);
  for (const stroke of strokes) {
    if (!stroke?.points?.length) continue;
    const value = stroke.mode === "erase" ? 255 : 0;
    if (stroke.points.length === 1) {
      drawLine(next, width, height, stroke.points[0], stroke.points[0], stroke.brushSize, value);
      continue;
    }
    for (let index = 1; index < stroke.points.length; index += 1) {
      drawLine(next, width, height, stroke.points[index - 1], stroke.points[index], stroke.brushSize, value);
    }
  }
  return next;
}

function pointDistanceInMaskPixels(from, to, width, height) {
  return Math.hypot((to.x - from.x) * (width - 1), (to.y - from.y) * (height - 1));
}

function shouldAppendStrokePoint(from, to, brushSize, width, height) {
  return pointDistanceInMaskPixels(from, to, width, height) >= Math.max(0.75, brushSize / 8);
}

function pointToCanvas(point, width, height) {
  return {
    x: point.x * width,
    y: point.y * height,
  };
}

function createStrokePath(points, width, height, offsetX = 0, offsetY = 0) {
  if (!points.length) return "";
  const first = pointToCanvas(points[0], width, height);
  let path = `M ${offsetX + first.x} ${offsetY + first.y}`;
  for (let index = 1; index < points.length; index += 1) {
    const next = pointToCanvas(points[index], width, height);
    path += ` L ${offsetX + next.x} ${offsetY + next.y}`;
  }
  return path;
}

function strokeWidthForDisplay(stroke, displayWidth, displayHeight, maskWidth, maskHeight) {
  if (!maskWidth || !maskHeight) return stroke.brushSize;
  const scaleX = displayWidth / maskWidth;
  const scaleY = displayHeight / maskHeight;
  return Math.max(1, stroke.brushSize * ((scaleX + scaleY) / 2));
}

function SkiaMaskOverlay({
  overlayUri,
  displayRect,
  previewTransform,
  maskWidth,
  maskHeight,
  strokes,
  currentStroke,
}) {
  const initialOverlay = useImage(overlayUri);
  const overlayColor = `rgba(${OVERLAY_RGB[0]}, ${OVERLAY_RGB[1]}, ${OVERLAY_RGB[2]}, ${OVERLAY_ALPHA / 255})`;
  const renderStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
  const imageClip = rect(displayRect.x, displayRect.y, displayRect.width, displayRect.height);

  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Group layer origin={previewTransform.origin} transform={previewTransform.skiaTransform}>
        <Group clip={imageClip}>
          {initialOverlay ? (
            <SkiaImage
              image={initialOverlay}
              x={displayRect.x}
              y={displayRect.y}
              width={displayRect.width}
              height={displayRect.height}
              fit="fill"
            />
          ) : null}
          {renderStrokes.map((stroke) => {
            const strokeWidth = strokeWidthForDisplay(stroke, displayRect.width, displayRect.height, maskWidth, maskHeight);
            const blendMode = stroke.mode === "erase" ? "clear" : "src";
            const color = stroke.mode === "erase" ? "rgba(0, 0, 0, 0)" : overlayColor;
            if (stroke.points.length === 1) {
              const point = pointToCanvas(stroke.points[0], displayRect.width, displayRect.height);
              return (
                <Circle
                  key={stroke.id}
                  cx={displayRect.x + point.x}
                  cy={displayRect.y + point.y}
                  r={strokeWidth / 2}
                  color={color}
                  blendMode={blendMode}
                  antiAlias
                />
              );
            }
            return (
              <Path
                key={stroke.id}
                path={createStrokePath(stroke.points, displayRect.width, displayRect.height, displayRect.x, displayRect.y)}
                color={color}
                style="stroke"
                strokeWidth={strokeWidth}
                strokeCap="round"
                strokeJoin="round"
                blendMode={blendMode}
                antiAlias
              />
            );
          })}
        </Group>
      </Group>
    </Canvas>
  );
}

function ToolbarButton({ icon, active, onPress, disabled, label, children, large }) {
  const { colors, radius } = useAppTheme();
  const iconColor = disabled ? colors.inactive : active ? colors.chipActiveText : colors.text;
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        large ? styles.actionToolButton : styles.toolButton,
        {
          opacity: disabled ? 0.35 : pressed ? 0.72 : 1,
          borderRadius: radius.pill,
          backgroundColor: active ? colors.chipActiveBackground : colors.secondaryBackground,
          borderColor: active ? colors.chipActiveBackground : colors.border,
        },
      ]}
    >
      {children ?? <Ionicons name={icon} size={large ? 22 : 18} color={iconColor} />}
    </Pressable>
  );
}

function MirrorIcon({ color = "#FFFFFF" }) {
  return (
    <View style={styles.mirrorIcon}>
      <View
        style={[
          styles.mirrorTriangle,
          {
            borderRightColor: color,
            transform: [{ scaleX: -1 }],
          },
        ]}
      />
      <View style={[styles.mirrorAxis, { backgroundColor: color }]} />
      <View style={[styles.mirrorTriangle, { borderRightColor: color }]} />
    </View>
  );
}

export default function WardrobeMaskEditorScreen({ navigation, route }) {
  const { colors, radius, typography } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { actions } = useWardrobe();
  const draftId = route.params?.draftId;
  const itemId = route.params?.itemId ?? null;
  const batchId = route.params?.batchId ?? null;
  const entryId = route.params?.entryId ?? null;
  const returnRouteKey = route.params?.returnRouteKey ?? null;
  const [freshSource, setFreshSource] = useState(null);
  const hasLocalEditsRef = useRef(false);
  const editorImageUrl = freshSource?.editorImageUrl ?? route.params?.editorImageUrl;
  const originalImageUrl = freshSource?.originalImageUrl ?? route.params?.originalImageUrl;
  const originalImagePreviewDataUrl = freshSource?.originalImagePreviewDataUrl ?? route.params?.originalImagePreviewDataUrl;
  const maskBitmap = freshSource?.maskBitmap ?? route.params?.maskBitmap;
  const hasRouteImageSource = Boolean(route.params?.editorImageUrl || route.params?.originalImagePreviewDataUrl || route.params?.originalImageUrl);
  const hasRouteMaskBitmap = Boolean(route.params?.maskBitmap?.dataBase64);
  const hasMaskBitmap = Boolean(maskBitmap?.width && maskBitmap?.height && maskBitmap?.dataBase64);
  const initialWidth = hasMaskBitmap ? maskBitmap.width : 1;
  const initialHeight = hasMaskBitmap ? maskBitmap.height : 1;
  const initialMaskPayload = useMemo(() => {
    if (!hasMaskBitmap) {
      return { data: createFallbackMask(initialWidth, initialHeight), valid: false };
    }
    const data = decodeBase64(maskBitmap.dataBase64);
    return {
      data: data.length === initialWidth * initialHeight ? data : createFallbackMask(initialWidth, initialHeight),
      valid: data.length === initialWidth * initialHeight,
    };
  }, [hasMaskBitmap, initialHeight, initialWidth, maskBitmap?.dataBase64]);

  const [mode, setMode] = useState("erase");
  const [brushSize, setBrushSize] = useState(18);
  const [strokes, setStrokes] = useState([]);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [redoStrokes, setRedoStrokes] = useState([]);
  const [undoLockedCount, setUndoLockedCount] = useState(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageSize, setImageSize] = useState({ width: initialWidth, height: initialHeight });
  const [editorAreaSize, setEditorAreaSize] = useState({ width: 1, height: 1 });
  const initialMaskDataRef = useRef(initialMaskPayload.data);
  const previewFrameRef = useRef(null);
  const previewFramePageRef = useRef({ x: 0, y: 0, width: 0, height: 0, measured: false });
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);
  const undoLockedCountRef = useRef(0);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const canvasSizeRef = useRef({ width: 1, height: 1 });
  const flipHorizontalRef = useRef(false);
  const rotationDegreesRef = useRef(0);
  const strokeIdRef = useRef(0);
  const gestureRef = useRef({
    type: "idle",
    pinchStart: 0,
    pinchCenterStart: { x: 0, y: 0 },
    zoomStart: 1,
    offsetStart: { x: 0, y: 0 },
  });

  const maskWidth = initialWidth;
  const maskHeight = initialHeight;
  const preferredImageUrl = itemId
    ? originalImagePreviewDataUrl || editorImageUrl || originalImageUrl
    : editorImageUrl || originalImagePreviewDataUrl || originalImageUrl;
  const maskReady = initialMaskPayload.valid;
  const previewFrameSize = useMemo(
    () => fitRect(editorAreaSize, imageSize.width, imageSize.height),
    [editorAreaSize, imageSize.height, imageSize.width]
  );
  const imageLayoutReady = editorAreaSize.width > 1 && editorAreaSize.height > 1 && previewFrameSize.width > 1 && previewFrameSize.height > 1;
  const imageUrl = imageLayoutReady ? preferredImageUrl : null;
  const imageSource = useMemo(() => (imageUrl ? { uri: imageUrl } : null), [imageUrl]);
  const imageRenderKey = useMemo(
    () => `${draftId ?? itemId ?? "mask"}:${imageLayoutReady ? "ready" : "pending"}:${preferredImageUrl ?? "empty"}`,
    [draftId, imageLayoutReady, itemId, preferredImageUrl]
  );
  const displayRect = useMemo(() => fitRect(canvasSize, imageSize.width, imageSize.height), [canvasSize, imageSize]);
  const displayRectRef = useRef(displayRect);
  const overlayUri = useMemo(
    () => createOverlayPngUri(initialMaskPayload.data, maskWidth, maskHeight),
    [initialMaskPayload.data, maskHeight, maskWidth]
  );
  const previewTransform = useMemo(
    () => createImagePreviewTransform(displayRect, zoom, offset, flipHorizontal, rotationDegrees),
    [displayRect, flipHorizontal, offset, rotationDegrees, zoom]
  );
  const layerTransformOrigin = useMemo(
    () => [previewTransform.origin.x, previewTransform.origin.y, 0],
    [previewTransform.origin.x, previewTransform.origin.y]
  );
  const returnToConfirmScreen = useCallback(
    (params) => {
      const state = navigation.getState();
      const fallbackIndex = Math.max(0, state.routes.length - 2);
      const targetIndex = returnRouteKey
        ? state.routes.findIndex((screenRoute) => screenRoute.key === returnRouteKey)
        : fallbackIndex;

      if (targetIndex < 0) {
        navigation.goBack();
        return;
      }

      navigation.reset({
        index: targetIndex,
        routes: state.routes.slice(0, targetIndex + 1).map((screenRoute, index) => ({
          key: screenRoute.key,
          name: screenRoute.name,
          params: index === targetIndex ? { ...(screenRoute.params ?? {}), ...params } : screenRoute.params,
        })),
      });
    },
    [navigation, returnRouteKey]
  );

  useEffect(() => {
    let alive = true;

    async function loadFreshSource() {
      try {
        if (draftId) {
          const next = await actions.fetchDraft(draftId);
          if (!alive || hasLocalEditsRef.current) return;
          setFreshSource(next);
          return;
        }

        if (!itemId || (hasRouteImageSource && hasRouteMaskBitmap)) return;

        const next = await actions.fetchItem(itemId);
        if (!alive || hasLocalEditsRef.current) return;
        setFreshSource(next);
      } catch {
        return;
      }
    }

    loadFreshSource();
    return () => {
      alive = false;
    };
  }, [actions, draftId, hasRouteImageSource, hasRouteMaskBitmap, itemId, route.params?.editorOpenedAt]);

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    setImageSize({ width: maskWidth, height: maskHeight });
  }, [imageUrl, maskHeight, maskWidth]);

  const handleEditorAreaLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setEditorAreaSize({
      width: Math.max(1, width),
      height: Math.max(1, height),
    });
  }, []);

  useEffect(() => {
    initialMaskDataRef.current = initialMaskPayload.data;
    strokesRef.current = [];
    currentStrokeRef.current = null;
    undoLockedCountRef.current = 0;
    setStrokes([]);
    setCurrentStroke(null);
    setRedoStrokes([]);
    setUndoLockedCount(0);
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    flipHorizontalRef.current = false;
    rotationDegreesRef.current = 0;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setFlipHorizontal(false);
    setRotationDegrees(0);
  }, [initialMaskPayload.data]);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  useEffect(() => {
    displayRectRef.current = displayRect;
  }, [displayRect]);

  useEffect(() => {
    flipHorizontalRef.current = flipHorizontal;
  }, [flipHorizontal]);

  useEffect(() => {
    rotationDegreesRef.current = rotationDegrees;
  }, [rotationDegrees]);

  useEffect(() => {
    setOffset((current) => {
      const next = clampEditorOffset(current, canvasSize, displayRect, zoom);
      offsetRef.current = next;
      return next;
    });
  }, [canvasSize, displayRect, zoom]);

  const measurePreviewFrame = useCallback(() => {
    previewFrameRef.current?.measureInWindow?.((x, y, width, height) => {
      previewFramePageRef.current = { x, y, width, height, measured: true };
    });
  }, []);

  const handlePreviewLayout = useCallback(
    (event) => {
      const nextSize = event.nativeEvent.layout;
      canvasSizeRef.current = nextSize;
      setCanvasSize(nextSize);
      measurePreviewFrame();
    },
    [measurePreviewFrame]
  );

  const previewPointFromEvent = useCallback((event) => {
    const touch = event.nativeEvent.touches?.[0] ?? event.nativeEvent;
    const pageX = touch?.pageX ?? event.nativeEvent.pageX;
    const pageY = touch?.pageY ?? event.nativeEvent.pageY;
    const frame = previewFramePageRef.current;
    if (frame.measured && typeof pageX === "number" && typeof pageY === "number") {
      return { x: pageX - frame.x, y: pageY - frame.y };
    }
    return { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
  }, []);

  const pointFromEvent = useCallback((event) => {
    const transform = createImagePreviewTransform(
      displayRectRef.current,
      zoomRef.current,
      offsetRef.current,
      flipHorizontalRef.current,
      rotationDegreesRef.current
    );
    return transform.previewToNormalized(previewPointFromEvent(event));
  }, [previewPointFromEvent]);

  const createStrokeAtPoint = useCallback(
    (point) => {
      const nextStroke = {
        id: `stroke-${Date.now()}-${strokeIdRef.current}`,
        mode,
        brushSize,
        points: [point],
      };
      strokeIdRef.current += 1;
      return nextStroke;
    },
    [brushSize, mode]
  );

  const commitStroke = useCallback((stroke) => {
    if (!stroke?.points?.length) return;
    setStrokes((prev) => {
      const next = [...prev, stroke];
      const nextLockedCount = Math.max(undoLockedCountRef.current, next.length - HISTORY_LIMIT);
      undoLockedCountRef.current = nextLockedCount;
      setUndoLockedCount(nextLockedCount);
      strokesRef.current = next;
      return next;
    });
    setRedoStrokes([]);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (event) => {
          measurePreviewFrame();
          const touches = event.nativeEvent.touches;
          if (touches.length > 1) {
            gestureRef.current = {
              type: "pinch",
              pinchStart: Math.max(1, distance(touches)),
              pinchCenterStart: midpoint(touches),
              zoomStart: zoomRef.current,
              offsetStart: offsetRef.current,
            };
            currentStrokeRef.current = null;
            setCurrentStroke(null);
            return;
          }
          gestureRef.current = {
            type: "draw",
            pinchStart: 0,
            pinchCenterStart: { x: 0, y: 0 },
            zoomStart: zoomRef.current,
            offsetStart: offsetRef.current,
          };
          const point = pointFromEvent(event);
          if (!point) {
            currentStrokeRef.current = null;
            setCurrentStroke(null);
            return;
          }
          hasLocalEditsRef.current = true;
          const nextStroke = createStrokeAtPoint(point);
          currentStrokeRef.current = nextStroke;
          setCurrentStroke(nextStroke);
          if (strokesRef.current.length < undoLockedCountRef.current) {
            undoLockedCountRef.current = strokesRef.current.length;
            setUndoLockedCount(strokesRef.current.length);
          }
        },
        onPanResponderMove: (event) => {
          const touches = event.nativeEvent.touches;
          if (touches.length > 1) {
            if (gestureRef.current.type !== "pinch" || !gestureRef.current.pinchStart) {
              gestureRef.current = {
                type: "pinch",
                pinchStart: Math.max(1, distance(touches)),
                pinchCenterStart: midpoint(touches),
                zoomStart: zoomRef.current,
                offsetStart: offsetRef.current,
              };
              currentStrokeRef.current = null;
              setCurrentStroke(null);
              return;
            }
            const currentCenter = midpoint(touches);
            const nextZoom = clamp(
              gestureRef.current.zoomStart * (distance(touches) / gestureRef.current.pinchStart),
              MIN_ZOOM,
              MAX_ZOOM
            );
            const nextOffset = clampEditorOffset(
              {
                x: gestureRef.current.offsetStart.x + currentCenter.x - gestureRef.current.pinchCenterStart.x,
                y: gestureRef.current.offsetStart.y + currentCenter.y - gestureRef.current.pinchCenterStart.y,
              },
              canvasSizeRef.current,
              displayRectRef.current,
              nextZoom
            );
            zoomRef.current = nextZoom;
            offsetRef.current = nextOffset;
            setZoom(nextZoom);
            setOffset(nextOffset);
            return;
          }
          if (gestureRef.current.type === "pinch") {
            return;
          }
          const point = pointFromEvent(event);
          if (!point) {
            if (currentStrokeRef.current?.points?.length) {
              commitStroke(currentStrokeRef.current);
              currentStrokeRef.current = null;
              setCurrentStroke(null);
            }
            return;
          }
          setCurrentStroke((stroke) => {
            if (!stroke) {
              hasLocalEditsRef.current = true;
              const nextStroke = createStrokeAtPoint(point);
              currentStrokeRef.current = nextStroke;
              return nextStroke;
            }
            const previousPoint = stroke.points[stroke.points.length - 1] || point;
            if (!shouldAppendStrokePoint(previousPoint, point, stroke.brushSize, maskWidth, maskHeight)) {
              return stroke;
            }
            const nextStroke = { ...stroke, points: [...stroke.points, point] };
            currentStrokeRef.current = nextStroke;
            return nextStroke;
          });
        },
        onPanResponderRelease: () => {
          const stroke = currentStrokeRef.current;
          commitStroke(stroke);
          currentStrokeRef.current = null;
          setCurrentStroke(null);
          gestureRef.current = {
            type: "idle",
            pinchStart: 0,
            pinchCenterStart: { x: 0, y: 0 },
            zoomStart: zoomRef.current,
            offsetStart: offsetRef.current,
          };
        },
        onPanResponderTerminate: () => {
          const stroke = currentStrokeRef.current;
          commitStroke(stroke);
          currentStrokeRef.current = null;
          setCurrentStroke(null);
          gestureRef.current = {
            type: "idle",
            pinchStart: 0,
            pinchCenterStart: { x: 0, y: 0 },
            zoomStart: zoomRef.current,
            offsetStart: offsetRef.current,
          };
        },
      }),
    [
      brushSize,
      commitStroke,
      createStrokeAtPoint,
      maskHeight,
      maskWidth,
      measurePreviewFrame,
      mode,
      pointFromEvent,
    ]
  );

  const undo = () => {
    hasLocalEditsRef.current = true;
    setStrokes((prev) => {
      if (prev.length <= undoLockedCountRef.current) return prev;
      const previous = prev[prev.length - 1];
      if (previous) {
        setRedoStrokes((redo) => [...redo.slice(-(HISTORY_LIMIT - 1)), previous]);
      }
      const next = prev.slice(0, -1);
      strokesRef.current = next;
      return next;
    });
  };

  const redo = () => {
    hasLocalEditsRef.current = true;
    setRedoStrokes((prev) => {
      const next = prev[prev.length - 1];
      if (next) {
        setStrokes((undoHistory) => {
          const nextStrokes = [...undoHistory, next];
          const nextLockedCount = Math.max(undoLockedCountRef.current, nextStrokes.length - HISTORY_LIMIT);
          undoLockedCountRef.current = nextLockedCount;
          setUndoLockedCount(nextLockedCount);
          strokesRef.current = nextStrokes;
          return nextStrokes;
        });
      }
      return prev.slice(0, -1);
    });
  };

  const save = useCallback(async () => {
    if (!draftId && !itemId) return;
    if (!maskReady) {
      setError("Маска недоступна для редактирования");
      return;
    }
    if (!imageLoaded) {
      setError("Рабочее изображение еще не загружено");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const activeStroke = currentStrokeRef.current;
      const saveStrokes = activeStroke?.points?.length ? [...strokesRef.current, activeStroke] : strokesRef.current;
      const finalMaskData = applyStrokesToMask(initialMaskDataRef.current, maskWidth, maskHeight, saveStrokes);
      const maskFile = {
        uri: createPgmUri(finalMaskData, maskWidth, maskHeight),
        name: `wardrobe-mask-${draftId ?? itemId}.pgm`,
        type: "image/x-portable-graymap",
      };

      if (draftId) {
        const updatedDraftState = await actions.editDraftMask(draftId, {
          maskFile,
          flipHorizontal: flipHorizontalRef.current,
          rotationDegrees: rotationDegreesRef.current,
        });
        if (batchId && entryId) {
          actions.syncPhotoBatchEntryDraft(batchId, entryId, updatedDraftState);
        }
        returnToConfirmScreen({
          draftId,
          ...(batchId ? { batchId } : {}),
          ...(entryId ? { entryId } : {}),
          maskEditedAt: Date.now(),
          updatedDraftState,
        });
        return;
      }

      const updatedItem = await actions.editItemMask(itemId, {
        maskFile,
        flipHorizontal: flipHorizontalRef.current,
        rotationDegrees: rotationDegreesRef.current,
      });
      returnToConfirmScreen({
        itemId,
        maskEditedAt: Date.now(),
        updatedItem,
      });
    } catch (saveError) {
      setError(saveError.message || "Не удалось сохранить маску");
    } finally {
      setSaving(false);
    }
  }, [actions, batchId, draftId, entryId, imageLoaded, itemId, maskHeight, maskReady, maskWidth, returnToConfirmScreen]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Редактор маски",
      headerTitleAlign: "center",
      headerRight: () => (
        <Pressable
          disabled={saving || !maskReady || !imageLoaded}
          onPress={save}
          style={({ pressed }) => [
            styles.headerSaveButton,
            {
              opacity: saving || !maskReady || !imageLoaded ? 0.45 : pressed ? 0.72 : 1,
              backgroundColor: colors.text,
            },
          ]}
        >
          <Text style={[styles.headerSaveText, { color: colors.background }]}>{saving ? "Сохраняем..." : "Сохранить"}</Text>
        </Pressable>
      ),
    });
  }, [colors.background, colors.text, imageLoaded, maskReady, navigation, save, saving]);

  const canEdit = Boolean(imageUrl && maskReady && imageLoaded && !imageFailed);
  const imageErrorMessage = !preferredImageUrl
    ? "Рабочее изображение недоступно"
    : !maskReady
      ? "Маска недоступна для редактирования"
      : "Не удалось загрузить рабочее изображение";

  return (
    <Screen style={{ backgroundColor: "#ffffff" }} edges={["left", "right"]} contentStyle={{ backgroundColor: "#ffffff" }}>
      <View style={styles.editorArea} onLayout={handleEditorAreaLayout}>
        <View
          ref={previewFrameRef}
          style={[
            styles.previewFrame,
            {
              width: Math.max(1, previewFrameSize.width),
              height: Math.max(1, previewFrameSize.height),
            },
          ]}
          onLayout={handlePreviewLayout}
          {...(canEdit ? panResponder.panHandlers : {})}
        >
          {preferredImageUrl && maskReady && !imageFailed ? (
            <>
              {imageUrl ? (
                <View
                  key={imageRenderKey}
                  style={[styles.layerFrame, { transform: previewTransform.reactNativeTransform, transformOrigin: layerTransformOrigin }]}
                >
                  <MediaPreview
                    source={imageSource}
                    resizeMode="contain"
                    containerStyle={StyleSheet.absoluteFillObject}
                    onLoad={(event) => {
                      const nextWidth = event.nativeEvent?.source?.width;
                      const nextHeight = event.nativeEvent?.source?.height;
                      if (nextWidth && nextHeight) {
                        setImageSize({ width: nextWidth, height: nextHeight });
                      }
                      setImageLoaded(true);
                    }}
                    onError={() => {
                      setImageLoaded(false);
                      setImageFailed(true);
                    }}
                  />
                </View>
              ) : null}
              <SkiaMaskOverlay
                overlayUri={overlayUri}
                displayRect={displayRect}
                previewTransform={previewTransform}
                maskWidth={maskWidth}
                maskHeight={maskHeight}
                strokes={strokes}
                currentStroke={currentStroke}
              />
              {!imageLoaded ? (
                <View style={styles.loadingLayer} pointerEvents="none">
                  <ActivityIndicator color="#1F1F1F" />
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.messageBox}>
              <Ionicons name="image-outline" size={28} color="#1F1F1F" />
              <Text style={[typography.caption, { color: "#1F1F1F", textAlign: "center" }]}>{imageErrorMessage}</Text>
            </View>
          )}
        </View>
      </View>

      <View
        style={[
          styles.toolbar,
          {
            paddingBottom: Math.max(8, insets.bottom + 6),
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={styles.primaryToolRow}>
          <View style={[styles.segmented, { backgroundColor: colors.secondaryBackground, borderColor: colors.border }]}>
            <Pressable
              accessibilityLabel="Стереть"
              onPress={() => setMode("erase")}
              style={[
                styles.segment,
                { borderRadius: radius.pill },
                mode === "erase" ? { backgroundColor: colors.chipActiveBackground } : null,
              ]}
            >
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.9}
                numberOfLines={1}
                style={[
                  styles.segmentText,
                  { color: mode === "erase" ? colors.chipActiveText : colors.secondaryText },
                ]}
              >
                Стереть
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Восстановить"
              onPress={() => setMode("restore")}
              style={[
                styles.segment,
                { borderRadius: radius.pill },
                mode === "restore" ? { backgroundColor: colors.chipActiveBackground } : null,
              ]}
            >
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.9}
                numberOfLines={1}
                style={[
                  styles.segmentText,
                  { color: mode === "restore" ? colors.chipActiveText : colors.secondaryText },
                ]}
              >
                Восстановить
              </Text>
            </Pressable>
          </View>
          <View style={[styles.brushControl, { backgroundColor: colors.secondaryBackground, borderColor: colors.border }]}>
            <ToolbarButton label="Уменьшить кисть" onPress={() => setBrushSize((value) => clamp(value - 4, 6, 64))}>
              <Text style={[styles.symbol, { color: colors.text }]}>−</Text>
            </ToolbarButton>
            <View style={styles.brushPill}>
              <Text style={[styles.brushText, { color: colors.text }]}>{brushSize}</Text>
              <Text style={[styles.brushUnit, { color: colors.secondaryText }]}>px</Text>
            </View>
            <ToolbarButton label="Увеличить кисть" onPress={() => setBrushSize((value) => clamp(value + 4, 6, 64))}>
              <Text style={[styles.symbol, { color: colors.text }]}>+</Text>
            </ToolbarButton>
          </View>
        </View>
        <View style={styles.secondaryToolRow}>
          <View style={styles.actionGroup}>
            <ToolbarButton large label="Отменить" icon="arrow-undo-outline" disabled={strokes.length <= undoLockedCount} onPress={undo} />
          </View>
          <View style={styles.actionGroup}>
            <ToolbarButton large label="Вернуть" icon="arrow-redo-outline" disabled={!redoStrokes.length} onPress={redo} />
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.actionGroup}>
            <ToolbarButton
              large
              label="Отразить"
              active={flipHorizontal}
              onPress={() =>
                setFlipHorizontal((value) => {
                  const next = !value;
                  flipHorizontalRef.current = next;
                  return next;
                })
              }
            >
              <MirrorIcon color={flipHorizontal ? colors.chipActiveText : colors.text} />
            </ToolbarButton>
          </View>
          <View style={styles.actionGroup}>
            <ToolbarButton
              large
              label="Поворот влево"
              icon="refresh-outline"
              onPress={() =>
                setRotationDegrees((value) => {
                  const next = (value + 270) % 360;
                  rotationDegreesRef.current = next;
                  return next;
                })
              }
            />
          </View>
        </View>
      </View>
      {error ? (
        <View style={styles.errorToast}>
          <Text style={[typography.caption, { color: "#FFFFFF" }]}>{error}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerSaveButton: {
    minHeight: 34,
    minWidth: 86,
    paddingHorizontal: 12,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
  },
  headerSaveText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  editorArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 140,
    backgroundColor: "#FFFFFF",
  },
  previewFrame: {
    alignSelf: "center",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  layerFrame: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  toolbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    minHeight: 98,
    gap: 6,
    paddingTop: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  primaryToolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  segmented: {
    flex: 1,
    height: 36,
    minWidth: 184,
    padding: 2,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  segment: {
    flex: 1,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: "#111111",
  },
  segmentText: {
    color: "#6E6E73",
    fontSize: 12,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  brushControl: {
    height: 36,
    width: 90,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  secondaryToolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  actionGroup: {
    width: 48,
    alignItems: "center",
  },
  actionToolButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  separator: {
    width: 1,
    height: 36,
    backgroundColor: "#ffffff",
  },
  toolButton: {
    width: 28,
    height: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  symbol: {
    color: "#111111",
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "700",
  },
  brushPill: {
    height: 34,
    minWidth: 34,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  brushText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "700",
  },
  brushUnit: {
    color: "#6E6E73",
    fontSize: 9,
    fontWeight: "600",
    marginTop: -2,
  },
  mirrorIcon: {
    width: 22,
    height: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  mirrorTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  mirrorAxis: {
    width: 1.5,
    height: 18,
    borderRadius: 1,
  },
  messageBox: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
  },
  errorToast: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(217,45,32,0.92)",
  },
});
