import { chimneyTop, hash, ROOF_TOP, type Layout } from "./scene";
import type { Key } from "./palette";
import type { Pixel, Pose } from "./sprites";
import type { SceneName } from "./themes";

// Paper: "Banner · 煤球的花园 · 二十四节气" (小雪 / 大雪 / 冬至 specs).
// All sprites and coordinates are in integer 3 px grid cells.

export type WinterTermScene = "minor-snow" | "major-snow" | "winter-solstice";

export function isWinterTerm(scene: SceneName): scene is WinterTermScene {
  return scene === "minor-snow" || scene === "major-snow" || scene === "winter-solstice";
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const art = (rows: string[], colors: Record<string, Key>): Pixel[] =>
  rows.flatMap((row, y) => [...row].flatMap((c, x) => (colors[c] ? [[x, y, colors[c]] as Pixel] : [])));

const rects = (specs: readonly [x: number, y: number, w: number, h: number, key: Key][]): Pixel[] => {
  const out: Pixel[] = [];
  for (const [x, y, w, h, key] of specs) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) out.push([x + dx, y + dy, key]);
    }
  }
  return out;
};

// ============================================================================
// 小雪 · Minor Snow
// ============================================================================

export const PLAID_SCARF_ROW: Record<Pose, number> = {
  idle: 9,
  blink: 9,
  walk1: 9,
  walk2: 9,
  happy: 9,
  alert: 10,
  sleep: 10,
};

/** 12 × 3 woven plaid scarf (neck row + fringe). */
export const PLAID_SCARF: Pixel[] = rects([
  [0, 0, 12, 1, "persimmon"],
  [2, 0, 2, 1, "snow"],
  [6, 0, 2, 1, "snow"],
  [10, 0, 1, 1, "snow"],
  [4, 1, 1, 1, "persimmon"],
  [5, 1, 1, 1, "persimmonDeep"],
  [4, 2, 1, 1, "snow"],
]);

/** 8 × 8 sugar-frosted 柿饼 token floated on pet. */
export const PERSIMMON_CAKE_TOKEN: Pixel[] = rects([
  [3, 0, 2, 1, "wood3"],
  [2, 1, 4, 1, "brick"],
  [1, 2, 6, 4, "persimmon"],
  [2, 6, 4, 1, "persimmon"],
  [2, 2, 2, 2, "persimmonHi"],
  [5, 3, 1, 1, "snow"],
  [3, 5, 2, 1, "snow"],
]);

/** 4 × 4 single falling / landed ripe persimmon. */
export const SINGLE_PERSIMMON: Pixel[] = rects([
  [1, 0, 2, 1, "brick"],
  [0, 1, 4, 3, "persimmon"],
  [0, 1, 1, 1, "persimmonHi"],
]);

/** 11 × 6 bamboo drying rack (daytime 晒秋 prop). */
export const BAMBOO_RACK: Pixel[] = rects([
  [1, 2, 2, 2, "persimmon"],
  [4, 2, 2, 2, "persimmon"],
  [7, 2, 2, 2, "persimmon"],
  [1, 2, 2, 1, "snow"],
  [4, 2, 1, 1, "snow"],
  [7, 2, 2, 1, "snow"],
  [0, 4, 11, 1, "bamboo"],
  [1, 5, 2, 1, "bambooDark"],
  [8, 5, 2, 1, "bambooDark"],
]);

const BOUGH_TWIG: Pixel[] = rects([
  [0, 2, 3, 1, "wood3"],
  [2, 3, 4, 1, "wood3"],
  [5, 4, 5, 1, "wood3"],
  [9, 3, 3, 1, "wood3"],
  [11, 4, 3, 1, "wood3"],
  [4, 5, 3, 1, "wood3"],
]);

/** 5 fruits on the 15 × 10 bough. Indices 0 and 1 always stay (留柿待禽); 2, 3, 4 can drop. */
const BOUGH_FRUITS: readonly Pixel[][] = [
  // 0 (reserved)
  rects([
    [2, 3, 2, 1, "brick"],
    [2, 4, 2, 2, "persimmon"],
    [2, 4, 1, 1, "persimmonHi"],
  ]),
  // 1 (reserved)
  rects([
    [8, 2, 3, 1, "brick"],
    [8, 3, 3, 2, "persimmon"],
    [8, 3, 1, 1, "persimmonHi"],
    [10, 3, 1, 1, "snow"],
  ]),
  // 2 (drops 1st)
  rects([
    [13, 3, 2, 1, "brick"],
    [13, 4, 2, 2, "persimmon"],
  ]),
  // 3 (drops 2nd)
  rects([
    [5, 5, 2, 1, "brick"],
    [5, 6, 2, 2, "persimmon"],
    [6, 6, 1, 1, "snow"],
  ]),
  // 4 (drops 3rd)
  rects([
    [11, 5, 2, 1, "brick"],
    [11, 6, 2, 2, "persimmon"],
    [11, 6, 1, 1, "persimmonHi"],
  ]),
];

/** Compact 8 × 7 twin-霜柿 sprig for narrow screens (< 180 cells). */
const NARROW_SPRIG: Pixel[] = rects([
  [0, 1, 8, 1, "wood3"],
  [1, 2, 2, 1, "brick"],
  [1, 3, 2, 2, "persimmon"],
  [1, 3, 1, 1, "persimmonHi"],
  [5, 2, 2, 1, "brick"],
  [5, 3, 2, 2, "persimmon"],
  [6, 3, 1, 1, "snow"],
]);

/** Max fruits that may be shaken off while reserving 2 for winter birds (留柿待禽). */
export const MAX_DROPPED_PERSIMMONS = 3;
export const PERSIMMON_FALL_FOR = 0.75;

export interface FallingPersimmon {
  x: number;
  fromY: number;
  toY: number;
  born: number;
}

export function persimmonBoughBox(l: Layout): Box {
  if (l.tree) return { x: l.tree.x + 27, y: l.ground - 25, w: 15, h: 10 };
  return { x: Math.max(2, l.house.x - 8), y: l.ground - 19, w: 8, h: 7 };
}

export function brazierBox(l: Layout): Box {
  return { x: l.bowl - 2, y: l.ground - 9, w: 10, h: 9 };
}

export function bambooRackBox(l: Layout): Box {
  return { x: Math.max(2, l.bowl - 18), y: l.ground - 6, w: 11, h: 6 };
}

export function shakePersimmon(dropped: number): { nextDropped: number; spawned: boolean } {
  if (dropped >= MAX_DROPPED_PERSIMMONS) return { nextDropped: dropped, spawned: false };
  return { nextDropped: dropped + 1, spawned: true };
}

export function fallingPersimmonY(item: FallingPersimmon, t: number): number {
  const p = Math.max(0, Math.min(1, (t - item.born) / PERSIMMON_FALL_FOR));
  if (p < 0.8) {
    const k = p / 0.8;
    return Math.round(item.fromY + (item.toY - item.fromY) * k * k);
  }
  // 1-cell grass bounce at the end of the 750 ms fall.
  const b = (p - 0.8) / 0.2;
  return Math.round(item.toY - Math.sin(b * Math.PI));
}

function clayBrazier(fanned: boolean, t: number, still: boolean): Pixel[] {
  const pulse = still ? 1 : Math.floor((t % 3) / 1.5);
  const frame = still ? 0 : Math.floor(t * 4) % 3;
  if (!fanned) {
    const steam: Pixel[] =
      frame === 0
        ? [[3, 0, "zz"], [6, 1, "zz"], [4, 1, "snow"], [4, 2, "snow"], [6, 2, "snow"]]
        : frame === 1
          ? [[4, 0, "zz"], [5, 1, "snow"], [4, 2, "snow"]]
          : [[3, 1, "zz"], [6, 0, "zz"], [4, 1, "snow"], [6, 2, "snow"]];
    return [
      ...steam,
      ...rects([
        [2, 4, 2, 2, "persimmon"],
        [6, 4, 2, 2, "persimmon"],
        [2, 4, 1, 1, "persimmonHi"],
        [6, 4, 1, 1, "persimmonHi"],
        [4, 5, 2, 1, pulse ? "amber" : "persimmonDeep"],
        [1, 6, 8, 1, "clay"],
        [2, 7, 6, 1, "clayDark"],
        [4, 7, 2, 1, pulse ? "amber" : "persimmon"],
        [2, 8, 2, 1, "clayFoot"],
        [6, 8, 2, 1, "clayFoot"],
      ]),
    ];
  }
  // Fanned: doubled steam at 4 fps + 2 gold sparks + hot cream core.
  const steam: Pixel[] =
    frame === 0
      ? [[2, -2, "zz"], [3, -2, "zz"], [6, -1, "zz"], [7, -1, "zz"], [3, -1, "snow"], [3, 0, "snow"], [6, 0, "snow"], [6, 1, "snow"], [4, 1, "snow"], [4, 2, "snow"], [1, 1, "amber"], [8, 0, "amber"]]
      : frame === 1
        ? [[3, -2, "zz"], [6, -2, "zz"], [2, -1, "snow"], [4, 0, "snow"], [4, 1, "snow"], [7, 0, "snow"], [6, 2, "snow"], [0, 0, "amber"], [9, 1, "amber"]]
        : [[2, -1, "zz"], [7, -2, "zz"], [3, 0, "snow"], [3, 1, "snow"], [5, -1, "snow"], [6, 1, "snow"], [4, 2, "snow"], [1, 0, "amber"], [8, -1, "amber"]];
  return [
    ...steam,
    ...rects([
      [2, 4, 2, 2, "persimmon"],
      [6, 4, 2, 2, "persimmon"],
      [2, 4, 1, 1, "cream"],
      [6, 4, 1, 1, "cream"],
      [4, 5, 2, 1, "cream"],
      [1, 6, 8, 1, "clayLit"],
      [2, 7, 6, 1, "clayDark"],
      [4, 7, 2, 1, "amber"],
      [2, 8, 2, 1, "clayFoot"],
      [6, 8, 2, 1, "clayFoot"],
    ]),
  ];
}

export function minorSnowDecor(
  l: Layout,
  night: boolean,
  t: number,
  state: { fanned: boolean; dropped: number; swayUntil: number; falling: readonly FallingPersimmon[] },
  still = false,
): Pixel[] {
  const out: Pixel[] = [];
  const put = (dots: readonly Pixel[], ox: number, oy: number) => {
    for (const [x, y, k] of dots) out.push([x + ox, y + oy, k]);
  };

  // Persimmon bough (or narrow-screen sprig).
  const bough = persimmonBoughBox(l);
  const sway = !still && t < state.swayUntil ? (Math.floor(t * 16) % 2 === 0 ? 1 : -1) : 0;
  if (l.tree) {
    put(BOUGH_TWIG, bough.x + sway, bough.y);
    const remaining = 5 - Math.min(MAX_DROPPED_PERSIMMONS, state.dropped);
    for (let i = 0; i < remaining; i++) put(BOUGH_FRUITS[i], bough.x + sway, bough.y);
  } else {
    put(NARROW_SPRIG, bough.x + sway, bough.y);
  }

  // Landed and falling persimmons.
  for (const item of state.falling) {
    put(SINGLE_PERSIMMON, item.x, fallingPersimmonY(item, t));
  }

  // Clay brazier by the doorstep.
  const brazier = brazierBox(l);
  put(clayBrazier(state.fanned, t, still), brazier.x, brazier.y);

  // Daytime bamboo drying rack (晒秋).
  if (!night) {
    const rack = bambooRackBox(l);
    put(BAMBOO_RACK, rack.x, rack.y);
  }

  return out;
}

/** Sparse graupel pellets drifting down at 2 cells/s at night; touching G - 1 melts into a 2 × 1 ice-blue bead for 300 ms. */
export function minorSnowGraupel(l: Layout, night: boolean, t: number, still = false): Pixel[] {
  if (!night) return [];
  const out: Pixel[] = [];
  const G = l.ground;
  if (still) {
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(hash(i, 71) * (l.w - 6)) + 3;
      const y = Math.floor(hash(i, 72) * (G - 14)) + 4;
      out.push([x, y, "snow"]);
    }
    return out;
  }
  const count = 10;
  const fallH = G - 4;
  // 2 cells/s drift + 0.3 s melt bead at G - 1.
  const fallSecs = fallH / 2;
  const cycle = fallSecs + 0.3;
  for (let i = 0; i < count; i++) {
    const phase = (t + hash(i, 73) * cycle) % cycle;
    const baseX = Math.floor(hash(i, 74) * (l.w - 8)) + 4;
    if (phase < fallSecs) {
      const y = Math.floor(2 + phase * 2);
      const x = baseX + Math.round(Math.sin(phase * 0.9 + i) * 1.5);
      out.push([x, y, "snow"]);
      if (i % 3 === 0) {
        out.push([x - 1, y, "wood3"], [x + 1, y, "wood3"], [x, y - 1, "wood3"], [x, y + 1, "wood3"]);
      }
    } else {
      // 2 × 1 ice-blue melt bead on grass for 300 ms.
      const x = baseX + Math.round(Math.sin(fallSecs * 0.9 + i) * 1.5);
      out.push([x, G - 1, "lamp"], [x + 1, G - 1, "lamp"]);
    }
  }
  return out;
}

// ============================================================================
// 大雪 · Major Snow
// ============================================================================

export const EARMUFF_TOP: Record<Pose, number> = {
  idle: 3,
  blink: 3,
  walk1: 3,
  walk2: 3,
  happy: 3,
  alert: 4,
  sleep: 4,
};

/** 14 × 5 plush earmuffs (ear tips stay free). */
export const PLUSH_EARMUFFS: Pixel[] = rects([
  [3, 0, 8, 1, "g4"],
  [2, 1, 2, 1, "g4"],
  [10, 1, 2, 1, "g4"],
  [5, 0, 4, 1, "ice"],
  [0, 2, 2, 3, "snow"],
  [12, 2, 2, 3, "snow"],
  [1, 4, 1, 1, "ice"],
  [12, 4, 1, 1, "ice"],
]);

/** 9 × 8 roasted 红薯 token floated on pet. */
export const SWEET_POTATO_TOKEN: Pixel[] = rects([
  [3, 0, 1, 1, "zz"],
  [6, 1, 1, 1, "zz"],
  [4, 1, 1, 1, "snow"],
  [1, 4, 7, 3, "potatoSkin"],
  [2, 7, 5, 1, "potatoSkin"],
  [2, 3, 5, 2, "potato"],
  [3, 5, 3, 1, "potato"],
  [3, 3, 2, 1, "cream"],
]);

/** 11 × 9 snow-capped 南天竹 winterberry bush. */
export const WINTERBERRY: Pixel[] = rects([
  [2, 5, 2, 4, "g2"],
  [5, 4, 2, 5, "g2"],
  [8, 6, 2, 3, "g2"],
  [1, 6, 9, 2, "g2"],
  [2, 3, 3, 2, "berry"],
  [6, 2, 3, 2, "berry"],
  [8, 4, 2, 2, "berry"],
  [2, 3, 1, 1, "berryHi"],
  [6, 2, 1, 1, "berryHi"],
  [2, 2, 3, 1, "snow"],
  [6, 1, 3, 1, "snow"],
  [8, 3, 2, 1, "snow"],
]);

/** 5 × 5 six-rayed hex snow crystal. */
export const HEX_CRYSTAL: Pixel[] = rects([
  [2, 0, 1, 5, "lamp"],
  [0, 2, 5, 1, "lamp"],
  [1, 1, 1, 1, "g3"],
  [3, 1, 1, 1, "g3"],
  [1, 3, 1, 1, "g3"],
  [3, 3, 1, 1, "g3"],
  [2, 2, 1, 1, "snow"],
]);

/** 3 stages of snow-Meiqiu (all positioned in a 12 × 13 box anchored on the ground). */
const SNOW_CAT_STAGES: readonly Pixel[][] = [
  // Stage 1: starter snowball mound (10 × 8 at +1, +5)
  rects([
    [3, 6, 6, 2, "snow"],
    [2, 8, 8, 4, "snow"],
    [8, 8, 2, 4, "ice"],
    [3, 12, 6, 1, "ice"],
  ]),
  // Stage 2: snow ears (11 × 11 at +0, +2)
  rects([
    [2, 2, 1, 2, "snow"],
    [8, 2, 1, 2, "snow"],
    [2, 4, 7, 4, "snow"],
    [1, 8, 9, 4, "snow"],
    [7, 4, 2, 4, "ice"],
    [8, 8, 2, 4, "ice"],
    [2, 12, 7, 1, "ice"],
  ]),
  // Stage 3: finished snow-Meiqiu (12 × 13)
  rects([
    [2, 0, 1, 2, "snow"],
    [9, 0, 1, 2, "snow"],
    [2, 1, 3, 1, "snow"],
    [7, 1, 3, 1, "snow"],
    [2, 2, 8, 5, "snow"],
    [1, 8, 10, 4, "snow"],
    [8, 2, 2, 5, "ice"],
    [9, 8, 2, 4, "ice"],
    [2, 12, 8, 1, "ice"],
    [4, 4, 1, 1, "door"],
    [7, 4, 1, 1, "door"],
    [5, 5, 2, 1, "berry"],
    [2, 7, 8, 1, "berry"],
    [0, 9, 2, 1, "wood3"],
    [10, 9, 2, 1, "wood3"],
  ]),
];

/** Small roasted sweet-potato iron stove by the doorstep (8 × 7). */
function potatoPot(t: number, still: boolean): Pixel[] {
  const frame = still ? 0 : Math.floor(t * 4) % 2;
  const steam: Pixel[] = frame === 0 ? [[2, 0, "zz"], [5, 1, "snow"]] : [[3, 0, "snow"], [5, 0, "zz"]];
  return [
    ...steam,
    ...rects([
      [2, 2, 4, 2, "potato"],
      [2, 3, 4, 1, "potatoSkin"],
      [1, 4, 6, 2, "wood2"],
      [2, 6, 1, 1, "wood3"],
      [5, 6, 1, 1, "wood3"],
    ]),
  ];
}

export type SnowCatStage = 1 | 2 | 3;

export function nextSnowCatStage(stage: SnowCatStage): SnowCatStage {
  return stage === 3 ? 1 : ((stage + 1) as SnowCatStage);
}

export function snowCatBox(l: Layout): Box {
  const x = l.tree ? l.house.x - 36 : Math.max(2, l.house.x - 26);
  return { x, y: l.ground - 13, w: 12, h: 13 };
}

export function winterberryBox(l: Layout): Box {
  if (l.fence) return { x: Math.max(2, l.fence.x - 13), y: l.ground - 9, w: 11, h: 9 };
  return { x: Math.min(l.w - 11, l.house.x + l.house.w + 1), y: l.ground - 9, w: 11, h: 9 };
}

export function potatoPotBox(l: Layout): Box {
  return { x: l.bowl, y: l.ground - 7, w: 8, h: 7 };
}

export function eavesBox(l: Layout): Box {
  return { x: l.house.x, y: l.ground - ROOF_TOP, w: l.house.w, h: ROOF_TOP - 10 };
}

export const ICICLE_GLINT_FOR = 0.36;
export const SNOW_PRINT_FOR = 6.0;
export const MAX_SNOW_PRINTS = 6;
export const FLURRY_FOR = 3.0;

export interface SnowPrint {
  x: number;
  row: 0 | 1;
  born: number;
}

export function majorSnowDecor(
  l: Layout,
  t: number,
  state: { stage: SnowCatStage; glintAt: number | null; prints: readonly SnowPrint[] },
  still = false,
): Pixel[] {
  const out: Pixel[] = [];
  const put = (dots: readonly Pixel[], ox: number, oy: number) => {
    for (const [x, y, k] of dots) out.push([x + ox, y + oy, k]);
  };

  // Snow-Meiqiu.
  const catBox = snowCatBox(l);
  put(SNOW_CAT_STAGES[state.stage - 1], catBox.x, catBox.y);

  // Winterberry bush (南天竹).
  const bush = winterberryBox(l);
  put(WINTERBERRY, bush.x, bush.y);

  // Roasted sweet-potato stove.
  const pot = potatoPotBox(l);
  put(potatoPot(t, still), pot.x, pot.y);

  // 6 eave icicles (3 left, 3 right), 2 to 4 cells long.
  const eaveY = l.ground - 16;
  const spears: readonly [dx: number, len: number][] = [
    [1, 4],
    [4, 2],
    [7, 3],
    [31, 3],
    [34, 2],
    [37, 4],
  ];
  const glintAge = state.glintAt !== null ? (still ? 0 : t - state.glintAt) : -1;
  const activeIdx = glintAge >= 0 && glintAge < ICICLE_GLINT_FOR ? Math.floor((glintAge / ICICLE_GLINT_FOR) * spears.length) : -1;
  spears.forEach(([dx, len], idx) => {
    const x = l.house.x + dx;
    const lit = idx === activeIdx;
    for (let j = 0; j < len; j++) {
      out.push([x, eaveY + j, lit ? "glint" : j < len - 1 ? "rime" : "lamp"]);
    }
    if (lit) out.push([x, eaveY + len + 1, "glint"]);
  });

  // Paw prints in snowdrift (fading back to snow over 6.0 s).
  const prints: readonly SnowPrint[] = still
    ? [
        { x: Math.max(4, catBox.x - 18), row: 0, born: 0 },
        { x: Math.max(4, catBox.x - 13), row: 1, born: 0 },
        { x: Math.max(4, catBox.x - 8), row: 0, born: 0 },
      ]
    : state.prints;
  for (const p of prints) {
    const age = still ? 0 : t - p.born;
    if (age < 0 || age >= SNOW_PRINT_FOR) continue;
    const key: Key = age < 2 ? "g3" : age < 4 ? "g2" : "rime";
    const y = l.ground - 1 + p.row;
    out.push([p.x, y, key], [p.x + 1, y, key]);
  }

  return out;
}

/** Gentle hex snow crystals plus optional 3 s flurry triggered by clicking the sky. */
export function majorSnowFlakes(l: Layout, t: number, flurryUntil: number, still = false): Pixel[] {
  const out: Pixel[] = [];
  const put = (dots: readonly Pixel[], ox: number, oy: number) => {
    for (const [x, y, k] of dots) out.push([x + ox, y + oy, k]);
  };
  const G = l.ground;
  if (still) {
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(((i + 0.5) / 4) * (l.w - 16)) + 6;
      const y = 8 + (i % 2) * 10;
      put(HEX_CRYSTAL, x, y);
    }
    return out;
  }
  const gust = t < flurryUntil;
  const count = gust ? 14 : 6;
  const speed = gust ? 5.5 : 2.5;
  for (let i = 0; i < count; i++) {
    const x = Math.floor((hash(i, 81) * (l.w - 10) + Math.sin(t * 0.8 + i) * 4 + l.w) % (l.w - 6));
    const y = Math.floor((hash(i, 82) * (G - 8) + t * speed) % (G - 8));
    put(HEX_CRYSTAL, x, y);
  }
  return out;
}

// ============================================================================
// 冬至 · Winter Solstice
// ============================================================================

export const CAP_TOP: Record<Pose, number> = {
  idle: 0,
  blink: 0,
  walk1: 0,
  walk2: 0,
  happy: 0,
  alert: 1,
  sleep: 1,
};

/** 12 × 5 pom-pom knit cap (ears stay clear). */
export const KNIT_CAP: Pixel[] = rects([
  [5, 0, 2, 2, "snow"],
  [3, 2, 6, 2, "wool"],
  [2, 4, 8, 1, "snow"],
  [3, 4, 1, 1, "blush"],
  [5, 4, 1, 1, "blush"],
  [7, 4, 1, 1, "blush"],
  [9, 4, 1, 1, "blush"],
]);

/** 9 × 8 porcelain spoon with one white and one pink 汤圆. */
export const TANGYUAN_SPOON_TOKEN: Pixel[] = rects([
  [2, 0, 1, 1, "zz"],
  [5, 1, 1, 1, "zz"],
  [2, 1, 1, 1, "snow"],
  [1, 3, 3, 2, "snow"],
  [4, 3, 3, 2, "blush"],
  [7, 2, 2, 1, "snow"],
  [6, 3, 1, 1, "snow"],
  [0, 5, 7, 1, "snow"],
  [1, 6, 5, 1, "lamp"],
]);

/** 15 × 7 frost-gold solstice meteor. */
export const SOLSTICE_METEOR: Pixel[] = rects([
  [0, 5, 2, 2, "cream"],
  [2, 4, 3, 1, "amber"],
  [5, 3, 3, 1, "amber"],
  [8, 2, 3, 1, "lamp"],
  [11, 1, 2, 1, "lamp"],
  [14, 0, 1, 1, "lamp"],
]);

/** 4 × 3 cold night breath puff. */
export const BREATH_PUFF: Pixel[] = art(["d...", ".wd.", "...w"], { d: "zz", w: "snow" });

const TANGYUAN_BOWL_BASE: Pixel[] = rects([
  [2, 4, 2, 2, "snow"],
  [5, 4, 2, 2, "blush"],
  [7, 4, 2, 2, "snow"],
  [1, 6, 8, 1, "snow"],
  [1, 7, 8, 1, "g3"],
  [2, 8, 6, 1, "g2"],
]);

const TANGYUAN_STEAM: readonly Pixel[][] = [
  [[3, 1, "zz"], [6, 2, "zz"], [3, 2, "snow"], [3, 3, "snow"], [6, 3, "snow"]],
  [[2, 0, "zz"], [5, 1, "zz"], [3, 1, "snow"], [6, 2, "snow"], [4, 3, "snow"]],
  [[3, 0, "zz"], [7, 0, "zz"], [4, 2, "zz"], [6, 1, "snow"]],
];

const WINTERSWEET_BRANCH: Pixel[] = rects([
  [0, 9, 2, 1, "wood3"],
  [1, 8, 2, 1, "wood3"],
  [2, 7, 3, 1, "wood3"],
  [4, 6, 3, 1, "wood3"],
  [6, 5, 3, 1, "wood3"],
  [8, 4, 3, 1, "wood3"],
  [10, 3, 2, 1, "wood3"],
  [5, 7, 2, 1, "wood3"],
  [7, 8, 2, 1, "wood3"],
]);

/** 9 九九消寒 bloom centers on the 14 × 10 branch (first 4 open by default). */
const WINTERSWEET_BLOOMS: readonly [x: number, y: number][] = [
  [3, 5],
  [7, 3],
  [11, 2],
  [8, 7],
  [1, 6],
  [5, 4],
  [9, 5],
  [13, 2],
  [4, 8],
];

const NARROW_WINTERSWEET_BRANCH: Pixel[] = rects([
  [0, 7, 2, 1, "wood3"],
  [1, 6, 3, 1, "wood3"],
  [3, 5, 3, 1, "wood3"],
  [5, 4, 2, 1, "wood3"],
]);

const NARROW_WINTERSWEET_BLOOMS: readonly [x: number, y: number][] = [
  [2, 4],
  [5, 2],
  [6, 5],
  [3, 6],
  [1, 5],
  [4, 3],
  [7, 3],
  [2, 2],
  [6, 1],
];

export const MAX_WINTERSWEET_BLOOMS = 9;
export const METEOR_FOR = 1.2;

export interface SolsticeMeteor {
  x: number;
  y: number;
  born: number;
}

export interface FallingPetal {
  x: number;
  y: number;
  born: number;
}

export function wintersweetBox(l: Layout): Box {
  if (l.fence) return { x: l.fence.x + l.fence.w - 15, y: l.ground - 17, w: 14, h: 10 };
  return { x: Math.max(2, l.house.x - 5), y: l.ground - 14, w: 8, h: 8 };
}

export function tangyuanBowlBox(l: Layout): Box {
  return { x: l.bowl - 1, y: l.ground - 9, w: 10, h: 9 };
}

export function openWintersweet(blooms: number): number {
  return Math.min(MAX_WINTERSWEET_BLOOMS, blooms + 1);
}

/** At most one solstice meteor in flight (1.2 s); ignore extra clicks until it clears. */
export function launchMeteor(current: SolsticeMeteor | null, l: Layout, x: number, y: number, t: number): SolsticeMeteor {
  if (current && t - current.born < METEOR_FOR) return current;
  return {
    x: Math.max(16, Math.min(l.w - 4, Math.round(x))),
    y: Math.max(4, Math.min(l.ground - 28, Math.round(y))),
    born: t,
  };
}

export function meteorFrame(meteor: SolsticeMeteor, t: number, still = false): Pixel[] {
  const age = t - meteor.born;
  if (!still && (age < 0 || age >= METEOR_FOR)) return [];
  const p = still ? 0.45 : age / METEOR_FOR;
  const ox = Math.round(meteor.x - p * 34);
  const oy = Math.round(meteor.y + p * 12);
  return SOLSTICE_METEOR.map(([x, y, k]) => [ox + x, oy + y, k] as Pixel);
}

export function winterSolsticeDecor(
  l: Layout,
  t: number,
  state: { stoked: boolean; blooms: number; meteor: SolsticeMeteor | null; petals: readonly FallingPetal[] },
  still = false,
): Pixel[] {
  const out: Pixel[] = [];
  const put = (dots: readonly Pixel[], ox: number, oy: number) => {
    for (const [x, y, k] of dots) out.push([x + ox, y + oy, k]);
  };

  // Tangyuan bowl + 4 fps steam (static 2-dot steam in reduced motion).
  const bowl = tangyuanBowlBox(l);
  put(TANGYUAN_BOWL_BASE, bowl.x, bowl.y);
  if (still) {
    out.push([bowl.x + 3, bowl.y + 2, "snow"], [bowl.x + 6, bowl.y + 3, "snow"]);
  } else {
    put(TANGYUAN_STEAM[Math.floor(t * 4) % TANGYUAN_STEAM.length], bowl.x, bowl.y);
  }

  // Wintersweet branch (4..9 blooms).
  const ws = wintersweetBox(l);
  const branch = l.fence ? WINTERSWEET_BRANCH : NARROW_WINTERSWEET_BRANCH;
  const centers = l.fence ? WINTERSWEET_BLOOMS : NARROW_WINTERSWEET_BLOOMS;
  put(branch, ws.x, ws.y);
  centers.forEach(([bx, by], i) => {
    if (i < state.blooms) {
      out.push(
        [ws.x + bx, ws.y + by - 1, "amber"],
        [ws.x + bx - 1, ws.y + by, "amber"],
        [ws.x + bx + 1, ws.y + by, "amber"],
        [ws.x + bx, ws.y + by + 1, "amber"],
        [ws.x + bx, ws.y + by, "plumHeart"],
      );
    } else {
      out.push([ws.x + bx, ws.y + by, "plumBud"]);
    }
  });

  // Falling golden petals (6 cells/s).
  if (!still) {
    for (const petal of state.petals) {
      const y = Math.round(petal.y + (t - petal.born) * 6);
      if (y < l.ground) {
        const dx = Math.round(Math.sin((t - petal.born) * 5) * 1.5);
        out.push([petal.x + dx, y, "amber"], [petal.x + dx + 1, y, "amber"]);
      }
    }
  }

  // Chimney smoke: banked spawns 1 dot every 2.5 s; stoked bursts 3 brisk puffs + 2 amber sparks.
  const flue = chimneyTop(l);
  if (still) {
    out.push([flue.x + 1, flue.y - 2, "snow"], [flue.x + 2, flue.y - 4, "zz"]);
    if (state.stoked) out.push([flue.x + 3, flue.y - 6, "snow"], [flue.x + 4, flue.y - 5, "amber"]);
  } else if (state.stoked) {
    for (let i = 0; i < 3; i++) {
      const p = ((t * 0.9 + i / 3) % 1);
      const x = flue.x + 1 + Math.round(p * 5);
      const y = flue.y - 1 - Math.round(p * 8);
      out.push([x, y, p < 0.7 ? "snow" : "zz"], [x + 1, y, p < 0.7 ? "snow" : "zz"]);
    }
    const sp = (t * 2) % 1;
    out.push(
      [flue.x + Math.round(sp * 3), flue.y - 2 - Math.round(sp * 4), "amber"],
      [flue.x + 3 + Math.round(sp * 2), flue.y - 3 - Math.round(sp * 5), "amber"],
    );
  } else {
    const p = (t % 2.5) / 2.5;
    const x = flue.x + 1 + Math.round(p * 2);
    const y = flue.y - 1 - Math.round(p * 6);
    out.push([x, y, p < 0.65 ? "snow" : "zz"]);
  }

  // Solstice meteor.
  if (state.meteor) put(meteorFrame(state.meteor, t, still), 0, 0);

  return out;
}
