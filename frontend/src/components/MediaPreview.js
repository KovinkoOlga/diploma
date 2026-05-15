import React from "react";
import { Image, StyleSheet, View } from "react-native";

const defaultFallback = require("../../assets/icon.png");

export default function MediaPreview({
  source,
  fallbackSource = defaultFallback,
  containerStyle,
  resizeMode = "cover",
  placeholderScale = 0.56,
}) {
  const actualSource = source ?? fallbackSource;
  const isPlaceholder = actualSource === fallbackSource;

  return (
    <View style={[styles.container, containerStyle]}>
      {isPlaceholder ? (
        <Image
          source={fallbackSource}
          resizeMode="contain"
          style={[
            styles.placeholder,
            {
              width: `${placeholderScale * 100}%`,
              height: `${placeholderScale * 100}%`,
            },
          ]}
        />
      ) : (
        <Image source={actualSource} resizeMode={resizeMode} style={StyleSheet.absoluteFillObject} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    opacity: 0.72,
  },
});
