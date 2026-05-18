import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import {
  MAX_OBJECT_SCALE,
  MIN_OBJECT_SCALE,
  getCoverObjectBaseSize,
} from "../utils/outfitCover";
import MediaPreview from "./MediaPreview";

function clampValue(value, min, max) {
  "worklet";
  return Math.max(min, Math.min(max, value));
}

function clampToCanvasByCenter(x, y, canvasWidth, canvasHeight) {
  "worklet";
  return {
    x: clampValue(x, 0, canvasWidth),
    y: clampValue(y, 0, canvasHeight),
  };
}

export default function OutfitCoverCanvasObject({
  object,
  item,
  selected,
  canvas,
  displayScale,
  gesturesEnabled,
  showSelectionTint,
  onSelectItem,
  onCommitObject,
}) {
  const x = useSharedValue(object.x);
  const y = useSharedValue(object.y);
  const objectScale = useSharedValue(object.scale ?? 1);
  const rotation = useSharedValue(object.rotation ?? 0);

  const panStartX = useSharedValue(object.x);
  const panStartY = useSharedValue(object.y);
  const pinchStartScale = useSharedValue(object.scale ?? 1);
  const rotationStart = useSharedValue(object.rotation ?? 0);
  const activeGestures = useSharedValue(0);
  const interactionStarted = useSharedValue(false);

  const imageSource = item?.image ?? null;
  const baseSize = useMemo(() => getCoverObjectBaseSize(object.crop), [object.crop]);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    x.value = object.x;
  }, [object.x, x]);

  useEffect(() => {
    y.value = object.y;
  }, [object.y, y]);

  useEffect(() => {
    objectScale.value = object.scale ?? 1;
  }, [object.scale, objectScale]);

  useEffect(() => {
    rotation.value = object.rotation ?? 0;
  }, [object.rotation, rotation]);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [imageSource]);

  useEffect(() => {
    if (__DEV__ && !imageSource) {
      console.warn("[OutfitCover] Missing image source for cover object", {
        itemId: item?.id,
        categoryId: item?.categoryId,
      });
    }
  }, [imageSource, item?.categoryId, item?.id]);

  const objectAnimatedStyle = useAnimatedStyle(() => {
    const safeScale = clampValue(objectScale.value || 1, MIN_OBJECT_SCALE, MAX_OBJECT_SCALE);
    const width = baseSize.widthBase * displayScale;
    const height = baseSize.heightBase * displayScale;

    return {
      left: x.value * displayScale - width / 2,
      top: y.value * displayScale - height / 2,
      width,
      height,
      transform: [
        { scale: safeScale },
        { rotate: `${rotation.value}deg` },
        { scaleX: object.flipX ? -1 : 1 },
      ],
    };
  }, [baseSize.heightBase, baseSize.widthBase, displayScale, object.flipX]);

  const beginInteraction = () => {
    "worklet";
    if (!interactionStarted.value) {
      interactionStarted.value = true;
      runOnJS(onSelectItem)(object.itemId);
    }
    activeGestures.value += 1;
  };

  const finalizeInteraction = () => {
    "worklet";
    activeGestures.value = Math.max(0, activeGestures.value - 1);
    if (activeGestures.value !== 0) return;
    if (!interactionStarted.value) return;

    interactionStarted.value = false;
    const clamped = clampToCanvasByCenter(x.value, y.value, canvas.width, canvas.height);
    x.value = clamped.x;
    y.value = clamped.y;

    runOnJS(onCommitObject)(object.itemId, {
      x: clamped.x,
      y: clamped.y,
      scale: clampValue(objectScale.value, MIN_OBJECT_SCALE, MAX_OBJECT_SCALE),
      rotation: rotation.value,
    });
  };

  const pan = Gesture.Pan()
    .enabled(gesturesEnabled)
    .minDistance(1)
    .maxPointers(1)
    .averageTouches(true)
    .onStart(() => {
      panStartX.value = x.value;
      panStartY.value = y.value;
      beginInteraction();
    })
    .onUpdate((event) => {
      const nextX = panStartX.value + event.translationX / displayScale;
      const nextY = panStartY.value + event.translationY / displayScale;
      const clamped = clampToCanvasByCenter(nextX, nextY, canvas.width, canvas.height);
      x.value = clamped.x;
      y.value = clamped.y;
    })
    .onFinalize(() => {
      finalizeInteraction();
    });

  const pinch = Gesture.Pinch()
    .enabled(gesturesEnabled)
    .onStart(() => {
      pinchStartScale.value = objectScale.value;
      beginInteraction();
    })
    .onUpdate((event) => {
      objectScale.value = clampValue(pinchStartScale.value * event.scale, MIN_OBJECT_SCALE, MAX_OBJECT_SCALE);
      const clamped = clampToCanvasByCenter(x.value, y.value, canvas.width, canvas.height);
      x.value = clamped.x;
      y.value = clamped.y;
    })
    .onFinalize(() => {
      finalizeInteraction();
    });

  const rotate = Gesture.Rotation()
    .enabled(gesturesEnabled)
    .onStart(() => {
      rotationStart.value = rotation.value;
      beginInteraction();
    })
    .onUpdate((event) => {
      rotation.value = rotationStart.value + (event.rotation * 180) / Math.PI;
    })
    .onFinalize(() => {
      finalizeInteraction();
    });

  const tap = Gesture.Tap()
    .enabled(gesturesEnabled)
    .onStart(() => {
      runOnJS(onSelectItem)(object.itemId);
    });

  const gesture = Gesture.Simultaneous(tap, pan, pinch, rotate);
  const showImage = Boolean(imageSource) && !imageLoadFailed;

  const mediaFrameStyle =
    object.crop === "left-half"
      ? styles.leftHalfMediaFrame
      : object.crop === "right-half"
        ? styles.rightHalfMediaFrame
        : styles.fullMediaFrame;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.root,
          {
            zIndex: object.zIndex + 1,
            borderWidth: selected && showSelectionTint ? 1.5 : 0,
          },
          objectAnimatedStyle,
        ]}
      >
        <View style={styles.imageClip}>
          {showImage ? (
            <View style={[styles.mediaFrame, mediaFrameStyle]}>
              <MediaPreview
                source={imageSource}
                resizeMode="contain"
                containerStyle={styles.mediaPreview}
                placeholderScale={0.5}
                onError={() => {
                  if (__DEV__) {
                    console.warn("[OutfitCover] Failed to load image", {
                      itemId: item?.id,
                      categoryId: item?.categoryId,
                      source: imageSource,
                    });
                  }
                  setImageLoadFailed(true);
                }}
              />
            </View>
          ) : (
            <View style={styles.fallback}>
              <View style={styles.fallbackBadge}>
                <Ionicons name="image-outline" size={16} color="#6B7280" />
                <Text style={styles.fallbackText}>Нет изображения</Text>
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    borderColor: "rgba(17,17,17,0.38)",
    borderRadius: 10,
    backgroundColor: "transparent",
  },

  imageClip: {
    flex: 1,
    position: "relative",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "transparent",
  },

  mediaFrame: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },

  fullMediaFrame: {
    left: 0,
    right: 0,
  },

  leftHalfMediaFrame: {
    left: 0,
    width: "200%",
  },

  rightHalfMediaFrame: {
    right: 0,
    width: "200%",
  },

  mediaPreview: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },

  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },

  fallbackBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(243,244,246,0.95)",
  },

  fallbackText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
});
