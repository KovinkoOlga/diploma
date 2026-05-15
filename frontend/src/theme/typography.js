import { Platform } from "react-native";

const system = Platform.select({
  ios: "System",
  android: "System",
  default: "System",
});

export const typography = {
  fontFamily: system,
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  screenTitle: {
    fontFamily: system,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontFamily: system,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  cardTitle: {
    fontFamily: system,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0,
  },
  body: {
    fontFamily: system,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "400",
    letterSpacing: 0,
  },
  caption: {
    fontFamily: system,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    letterSpacing: 0,
  },
  meta: {
    fontFamily: system,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    letterSpacing: 0,
  },
  tabLabel: {
    fontFamily: system,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "500",
    letterSpacing: 0,
  },
  button: {
    fontFamily: system,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    letterSpacing: 0,
  },
  headerTitle: {
    fontFamily: system,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  h1: {
    fontFamily: system,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: system,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: system,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  small: {
    fontFamily: system,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "400",
    letterSpacing: 0,
  },
};
