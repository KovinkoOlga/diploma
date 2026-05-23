import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import OutfitCoverCanvasObject from "./OutfitCoverCanvasObject";

export default function OutfitCoverCanvas({
  editorState,
  itemById,
  selectedItemId,
  onSelectItem = () => {},
  onCommitObject = () => {},
  backgroundColor,
  interactive = true,
  canvasRef,
  showFrame = true,
  showSelectionTint = true,
}) {
  const { colors, radius } = useAppTheme();
  const [layout, setLayout] = useState(null);

  const canvas = editorState?.canvas ?? { width: 1080, height: 1350, previewBackground: "#FFFFFF" };
  const sortedObjects = useMemo(
    () => [...(editorState?.objects ?? [])].sort((left, right) => left.zIndex - right.zIndex),
    [editorState?.objects]
  );

  const displayWidth = layout?.width ?? 0;
  const ready = displayWidth > 20;
  const displayScale = ready ? displayWidth / canvas.width : 1;
  const gesturesEnabled = interactive && ready;

  return (
    <View
      onLayout={(event) => setLayout(event.nativeEvent.layout)}
      style={{
        width: "100%",
        aspectRatio: canvas.width / canvas.height,
        borderRadius: radius.xl,
        backgroundColor: backgroundColor ?? (canvas.previewBackground || "#FFFFFF"),
        borderWidth: showFrame ? 1 : 0,
        borderColor: colors.border,
        overflow: "hidden",
      }}
      ref={canvasRef}
      collapsable={false}
    >
      {ready
        ? sortedObjects.map((object) => {
            const item = itemById[object.itemId];
            if (!item) return null;
            return (
              <OutfitCoverCanvasObject
                key={object.id}
                object={object}
                item={item}
                selected={object.itemId === selectedItemId}
                canvas={canvas}
                displayScale={displayScale}
                gesturesEnabled={gesturesEnabled}
                showSelectionTint={showSelectionTint}
                onSelectItem={onSelectItem}
                onCommitObject={onCommitObject}
              />
            );
          })
        : null}
    </View>
  );
}
