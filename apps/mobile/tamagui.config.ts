import { createFont, createTamagui, createTokens } from "tamagui";

const tokens = createTokens({
  color: {
    ink: "#102A2B",
    inkMuted: "#5C7070",
    canvas: "#F5F2EA",
    surface: "#FFFEFB",
    surfaceDark: "#142425",
    canvasDark: "#091819",
    teal: "#087B78",
    tealDeep: "#055A5A",
    tealSoft: "#D9F1EE",
    gold: "#E4A93B",
    goldSoft: "#FFF0CC",
    border: "#D8E1DF",
    borderDark: "#2A4243",
    white: "#FFFFFF",
    danger: "#B44C42",
  },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48 },
  size: { 0: 0, 1: 20, 2: 28, 3: 36, 4: 44, 5: 52, 6: 64, 7: 80 },
  radius: { 0: 0, 1: 6, 2: 10, 3: 14, 4: 18, 5: 24, 6: 32, 7: 999 },
  zIndex: { 0: 0, 1: 10, 2: 20, 3: 30, 4: 40, 5: 50 },
});

const bodyFont = createFont({
  family: "System",
  size: { 1: 12, 2: 14, 3: 16, 4: 18, 5: 21, 6: 26, 7: 32 },
  lineHeight: { 1: 17, 2: 20, 3: 24, 4: 27, 5: 29, 6: 34, 7: 40 },
  weight: { 4: "400", 5: "500", 6: "600", 7: "700", 8: "800" },
  letterSpacing: { 4: 0, 7: -0.3, 8: -0.5 },
});

const light = {
  background: tokens.color.canvas,
  backgroundStrong: tokens.color.surface,
  color: tokens.color.ink,
  colorMuted: tokens.color.inkMuted,
  borderColor: tokens.color.border,
  accentBackground: tokens.color.teal,
  accentColor: tokens.color.white,
};

const dark = {
  background: tokens.color.canvasDark,
  backgroundStrong: tokens.color.surfaceDark,
  color: "#F2F7F6",
  colorMuted: "#A8BCBC",
  borderColor: tokens.color.borderDark,
  accentBackground: "#33AAA4",
  accentColor: tokens.color.canvasDark,
};

export const tamaguiConfig = createTamagui({
  tokens,
  themes: { light, dark },
  fonts: { body: bodyFont, heading: bodyFont },
  defaultFont: "body",
  shorthands: {
    p: "padding",
    px: "paddingHorizontal",
    py: "paddingVertical",
    pt: "paddingTop",
    pb: "paddingBottom",
    m: "margin",
    mt: "marginTop",
    mb: "marginBottom",
    ml: "marginLeft",
    bg: "backgroundColor",
  } as const,
});

export default tamaguiConfig;
export type AppTamaguiConfig = typeof tamaguiConfig;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}
