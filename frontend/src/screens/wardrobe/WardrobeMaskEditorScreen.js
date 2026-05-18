import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MediaPreview from "../../components/MediaPreview";
import Screen from "../../components/Screen";
import { Routes } from "../../navigation/routes";
import { useWardrobe } from "../../store/WardrobeStore";
import { useAppTheme } from "../../theme/ThemeProvider";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
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

function fitRect(container, imageWidth, imageHeight) {
  if (!container.width || !container.height || !imageWidth || !imageHeight) {
    return { x: 0, y: 0, width: container.width || 1, height: container.height || 1 };
  }
  const containerRatio = container.width / container.height;
  const imageRatio = imageWidth / imageHeight;
  if (imageRatio > containerRatio) {
    const width = container.width;
    const height = width / imageRatio;
    return { x: 0, y: 0, width, height };
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
  const [freshDraft, setFreshDraft] = useState(null);
  const hasLocalEditsRef = useRef(false);
  const originalImageUrl = freshDraft?.originalImageUrl ?? route.params?.originalImageUrl;
  const originalImagePreviewDataUrl = freshDraft?.originalImagePreviewDataUrl ?? route.params?.originalImagePreviewDataUrl;
  const maskBitmap = freshDraft?.maskBitmap ?? route.params?.maskBitmap;
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
  const [maskData, setMaskData] = useState(initialMaskPayload.data);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
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
  const lastPointRef = useRef(null);
  const maskDataRef = useRef(initialMaskPayload.data);
  const flipHorizontalRef = useRef(false);
  const rotationDegreesRef = useRef(0);
  const gestureRef = useRef({ pinchStart: 0, zoomStart: 1, offsetStart: { x: 0, y: 0 } });

  const maskWidth = initialWidth;
  const maskHeight = initialHeight;
  const imageUrl = originalImagePreviewDataUrl || originalImageUrl;
  const imageSource = useMemo(() => (imageUrl ? { uri: imageUrl } : null), [imageUrl]);
  const maskReady = initialMaskPayload.valid;
  const displayRect = useMemo(() => fitRect(canvasSize, imageSize.width, imageSize.height), [canvasSize, imageSize]);
  const displayStyle = useMemo(
    () => ({
      left: displayRect.x,
      top: displayRect.y,
      width: displayRect.width,
      height: displayRect.height,
    }),
    [displayRect]
  );
  const overlayUri = useMemo(() => createOverlayPngUri(maskData, maskWidth, maskHeight), [maskData, maskHeight, maskWidth]);
  const layerTransform = useMemo(
    () => [
      { translateX: offset.x },
      { translateY: offset.y },
      { scale: zoom },
      { scaleX: flipHorizontal ? -1 : 1 },
      { rotate: `${rotationDegrees}deg` },
    ],
    [flipHorizontal, offset.x, offset.y, rotationDegrees, zoom]
  );

  useEffect(() => {
    let alive = true;

    async function loadFreshDraft() {
      if (!draftId) return;
      try {
        const next = await actions.fetchDraft(draftId);
        if (!alive || hasLocalEditsRef.current) return;
        setFreshDraft(next);
      } catch {
        return;
      }
    }

    loadFreshDraft();
    return () => {
      alive = false;
    };
  }, [actions, draftId, route.params?.editorOpenedAt]);

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    setImageSize({ width: maskWidth, height: maskHeight });
  }, [imageUrl, maskHeight, maskWidth]);

  useEffect(() => {
    setMaskData(initialMaskPayload.data);
    maskDataRef.current = initialMaskPayload.data;
    setUndoStack([]);
    setRedoStack([]);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setFlipHorizontal(false);
    setRotationDegrees(0);
  }, [initialMaskPayload.data]);

  useEffect(() => {
    maskDataRef.current = maskData;
  }, [maskData]);

  useEffect(() => {
    flipHorizontalRef.current = flipHorizontal;
  }, [flipHorizontal]);

  useEffect(() => {
    rotationDegreesRef.current = rotationDegrees;
  }, [rotationDegrees]);

  useEffect(() => {
    setOffset((current) => clampEditorOffset(current, canvasSize, displayRect, zoom));
  }, [canvasSize, displayRect, zoom]);

  const pointFromLocation = (locationX, locationY) => {
    const centerX = displayRect.x + displayRect.width / 2;
    const centerY = displayRect.y + displayRect.height / 2;
    let dx = (locationX - centerX - offset.x) / zoom;
    let dy = (locationY - centerY - offset.y) / zoom;
    const radians = (-rotationDegrees * Math.PI) / 180;
    const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians);
    const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians);
    dx = flipHorizontal ? -rotatedX : rotatedX;
    dy = rotatedY;
    return {
      x: clamp(dx / displayRect.width + 0.5, 0, 1),
      y: clamp(dy / displayRect.height + 0.5, 0, 1),
    };
  };

  const applyPoint = (point, previousPoint = point) => {
    const value = mode === "erase" ? 255 : 0;
    setMaskData((current) => {
      const next = new Uint8Array(current);
      drawLine(next, maskWidth, maskHeight, previousPoint, point, brushSize, value);
      return next;
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches;
          gestureRef.current = { pinchStart: distance(touches), zoomStart: zoom, offsetStart: offset };
          if (touches.length > 1) return;
          hasLocalEditsRef.current = true;
          setUndoStack((prev) => [...prev, maskData]);
          setRedoStack([]);
          const point = pointFromLocation(event.nativeEvent.locationX, event.nativeEvent.locationY);
          lastPointRef.current = point;
          applyPoint(point);
        },
        onPanResponderMove: (event, gestureState) => {
          const touches = event.nativeEvent.touches;
          if (touches.length > 1) {
            const startDistance = gestureRef.current.pinchStart || distance(touches);
            const nextZoom = clamp(gestureRef.current.zoomStart * (distance(touches) / startDistance), MIN_ZOOM, MAX_ZOOM);
            const nextOffset = clampEditorOffset(
              {
                x: gestureRef.current.offsetStart.x + gestureState.dx,
                y: gestureRef.current.offsetStart.y + gestureState.dy,
              },
              canvasSize,
              displayRect,
              nextZoom
            );
            setZoom(nextZoom);
            setOffset(nextOffset);
            lastPointRef.current = null;
            return;
          }
          const point = pointFromLocation(event.nativeEvent.locationX, event.nativeEvent.locationY);
          applyPoint(point, lastPointRef.current || point);
          lastPointRef.current = point;
        },
        onPanResponderRelease: () => {
          lastPointRef.current = null;
        },
        onPanResponderTerminate: () => {
          lastPointRef.current = null;
        },
      }),
    [
      brushSize,
      canvasSize.height,
      canvasSize.width,
      displayRect.height,
      displayRect.width,
      displayRect.x,
      displayRect.y,
      flipHorizontal,
      maskData,
      mode,
      offset,
      rotationDegrees,
      zoom,
    ]
  );

  const undo = () => {
    hasLocalEditsRef.current = true;
    setUndoStack((prev) => {
      const previous = prev[prev.length - 1];
      if (previous) {
        setRedoStack((redo) => [...redo, maskData]);
        setMaskData(previous);
      }
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    hasLocalEditsRef.current = true;
    setRedoStack((prev) => {
      const next = prev[prev.length - 1];
      if (next) {
        setUndoStack((undoHistory) => [...undoHistory, maskData]);
        setMaskData(next);
      }
      return prev.slice(0, -1);
    });
  };

  const save = useCallback(async () => {
    if (!draftId) return;
    if (!maskReady) {
      setError("Маска недоступна для редактирования");
      return;
    }
    if (!imageLoaded) {
      setError("Исходное фото еще не загружено");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await actions.editDraftMask(draftId, {
        maskFile: {
          uri: createPgmUri(maskDataRef.current, maskWidth, maskHeight),
          name: `wardrobe-mask-${draftId}.pgm`,
          type: "image/x-portable-graymap",
        },
        flipHorizontal: flipHorizontalRef.current,
        rotationDegrees: rotationDegreesRef.current,
      });
      navigation.navigate({
        name: Routes.WardrobeConfirmItem,
        params: { draftId, maskEditedAt: Date.now() },
        merge: true,
      });
    } catch (saveError) {
      setError(saveError.message || "Не удалось сохранить обрезку");
    } finally {
      setSaving(false);
    }
  }, [actions, draftId, imageLoaded, maskHeight, maskReady, maskWidth, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Редактор обрезки",
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

  const canEdit = Boolean(imageUrl && maskReady && !imageFailed);
  const imageErrorMessage = !imageUrl
    ? "Исходное фото недоступно"
    : !maskReady
      ? "Маска недоступна для редактирования"
      : "Не удалось загрузить исходное фото";

  return (
    <Screen style={{ backgroundColor: "#ffffff" }} edges={["left", "right"]} contentStyle={{ backgroundColor: "#050505" }}>
      <View style={styles.editorArea}>
        <View
          style={[styles.previewFrame, { borderColor: colors.border }]}
          onLayout={(event) => setCanvasSize(event.nativeEvent.layout)}
          {...(canEdit ? panResponder.panHandlers : {})}
        >
          {imageUrl && maskReady && !imageFailed ? (
            <>
              <View style={[styles.layerFrame, { transform: layerTransform }]}>
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
                <View style={[displayStyle]}>
                  <Image
                    source={{ uri: overlayUri }}
                    resizeMode="contain"
                    pointerEvents="none"
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              </View>
              {!imageLoaded ? (
                <View style={styles.loadingLayer} pointerEvents="none">
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.messageBox}>
              <Ionicons name="image-outline" size={28} color="#FFFFFF" />
              <Text style={[typography.caption, { color: "#FFFFFF", textAlign: "center" }]}>{imageErrorMessage}</Text>
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
            <ToolbarButton large label="Отменить" icon="arrow-undo-outline" disabled={!undoStack.length} onPress={undo} />
          </View>
          <View style={styles.actionGroup}>
            <ToolbarButton large label="Вернуть" icon="arrow-redo-outline" disabled={!redoStack.length} onPress={redo} />
          </View>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.actionGroup}>
            <ToolbarButton large label="Отразить" active={flipHorizontal} onPress={() => setFlipHorizontal((value) => !value)}>
              <MirrorIcon color={flipHorizontal ? colors.chipActiveText : colors.text} />
            </ToolbarButton>
          </View>
          <View style={styles.actionGroup}>
            <ToolbarButton large label="Поворот влево" icon="refresh-outline" onPress={() => setRotationDegrees((value) => (value + 270) % 360)} />
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
  },
  previewFrame: {
    flex: 1,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "#ffffff",
  },
  layerFrame: {
    ...StyleSheet.absoluteFillObject,
    "position": "absolute0"
  },
  loadingLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
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
