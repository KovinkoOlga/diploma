import { Platform } from "react-native";

// Typography aims for editorial / journal feel:
// - headings: serif/humanist vibe, slightly spaced
// - body: calm, readable, not too bold
const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

const body = Platform.select({
  ios: "System",
  android: "System",
  default: "System",
});

export const typography = {
  fontFamily: body,
  fontFamilySerif: serif,

  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  sizes: {
    xs: 12,
    sm: 13,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 30,
    small: 13,
    body: 16,
    h3: 18,
    h2: 22,
    h1: 30,
  },

  // Ready-to-use text styles (prefer these over ad-hoc fontSize/fontWeight).
  h1: {
    fontFamily: serif,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  h2: {
    fontFamily: serif,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  h3: {
    fontFamily: serif,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  body: {
    fontFamily: body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    letterSpacing: 0,
  },
  caption: {
    fontFamily: body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    letterSpacing: 0.2,
  },
  small: {
    fontFamily: body,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    letterSpacing: 0.2,
  },
};
