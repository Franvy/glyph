// Colours of the garden banner, by role. Canvas can't read CSS variables cheaply on every
// frame, so the site tokens (src/styles/global.css) are mirrored here. The grass is the
// contribution scale; 煤球 keeps the colours of its sprite sheet in both themes. The weather and
// 春节 colours come from the Paper boards "Banner · 煤球的花园 天气 spec" and "… 春节 spec".

export type Key =
  | "bg" | "star" | "star2" | "star3" | "moon" | "moon2" | "moonDark"
  | "hill" | "soil" | "soil2" | "soilTop" | "pebble"
  | "g1" | "g2" | "g3" | "g4"
  | "wood" | "wood2" | "wood3"
  | "roof" | "roof2" | "ridge" | "wall" | "wallEdge" | "door" | "lamp" | "lamp2" | "lampOff"
  | "ink" | "petalC" | "pink" | "cushion" | "halo"
  | "cat" | "eye" | "zz" | "heart"
  | "cloud" | "cloudLit" | "cloudBelly" | "deck" | "deckLit" | "deckBelly" | "flash"
  | "drop" | "dropFar" | "puddle" | "puddleLit" | "bolt" | "boltEdge"
  | "flake" | "flakeArm" | "snow" | "snowShade" | "fog" | "fogThin"
  | "red" | "redLit" | "redDark" | "gold" | "brass" | "spark" | "smoke";

export type Palette = Record<Key, string>;

export const PALETTES: Record<"dark" | "light", Palette> = {
  dark: {
    bg: "#111111", star: "#2a2927", star2: "#6e6b65", star3: "#c2beb5", moon: "#edeae3", moon2: "#c2beb5", moonDark: "#1f1f1e",
    hill: "#141a24", soil: "#161615", soil2: "#1c1c1b", soilTop: "#2a2927", pebble: "#2a2927",
    g1: "#1c2b44", g2: "#24467a", g3: "#3466b0", g4: "#4a8fef",
    wood: "#2a2927", wood2: "#3a3936", wood3: "#6e6b65",
    roof: "#24548f", roof2: "#1b3557", ridge: "#4a8fef", wall: "#1f1f1e", wallEdge: "#3a3936",
    door: "#0a0a0a", lamp: "#8db4f0", lamp2: "#4a8fef", lampOff: "#1b3557",
    ink: "#edeae3", petalC: "#c2beb5", pink: "#f4a0ae", cushion: "#c9808c", halo: "#1b3557",
    cat: "#3c3b42", eye: "#f4f2ee", zz: "#6e6b65", heart: "#f4a0ae",
    cloud: "#2a2927", cloudLit: "#3a3936", cloudBelly: "#1f1f1e", deck: "#2f2e2c", deckLit: "#3f3e3b", deckBelly: "#242423",
    flash: "#171a21", drop: "#3466b0", dropFar: "#24467a", puddle: "#1c2b44", puddleLit: "#3466b0", bolt: "#edeae3",
    boltEdge: "#4a8fef", flake: "#c2beb5", flakeArm: "#6e6b65", snow: "#edeae3", snowShade: "#8f8b83", fog: "#262524",
    fogThin: "#1d1d1c", red: "#c8372a", redLit: "#f0603f", redDark: "#7a1f1a", gold: "#f0b941", brass: "#a8741e",
    spark: "#fff1c9", smoke: "#2b1613",
  },
  light: {
    bg: "#fbfaf8", star: "#fbfaf8", star2: "#fbfaf8", star3: "#fbfaf8", moon: "#a9c6f4", moon2: "#d6e4fa", moonDark: "#fbfaf8",
    hill: "#e3ecfa", soil: "#f2f1ee", soil2: "#ecebe7", soilTop: "#d4d1ca", pebble: "#d4d1ca",
    g1: "#a9c6f4", g2: "#6a9ee9", g3: "#3d82e6", g4: "#1f6fe0",
    wood: "#d4d1ca", wood2: "#b9b5ad", wood3: "#8f8b83",
    roof: "#1f6fe0", roof2: "#6a9ee9", ridge: "#1a4fa0", wall: "#ffffff", wallEdge: "#b9b5ad",
    door: "#3a3936", lamp: "#d6e4fa", lamp2: "#8db4f0", lampOff: "#ecebe7",
    ink: "#1a1a19", petalC: "#8f8b83", pink: "#f4a0ae", cushion: "#e8a3ad", halo: "#fbfaf8",
    cat: "#3c3b42", eye: "#f4f2ee", zz: "#8f8b83", heart: "#e86a82",
    cloud: "#e2e0db", cloudLit: "#b9b5ad", cloudBelly: "#d4d1ca", deck: "#b9b5ad", deckLit: "#cfccc5", deckBelly: "#a8a49c",
    flash: "#eef3fc", drop: "#6a9ee9", dropFar: "#a9c6f4", puddle: "#a9c6f4", puddleLit: "#d6e4fa", bolt: "#1f6fe0",
    boltEdge: "#a9c6f4", flake: "#8db4f0", flakeArm: "#c9d9f3", snow: "#ffffff", snowShade: "#c9d9f3", fog: "#e9e7e2",
    fogThin: "#f1f0ec", red: "#e0412f", redLit: "#e0412f", redDark: "#a82a20", gold: "#e3a32a", brass: "#b97a14",
    spark: "#fff1c9", smoke: "#d4d1ca",
  },
};
