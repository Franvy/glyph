import { hash, PEAK, ROOF_TOP, WALL, type Layout } from "./scene";
import type { Key } from "./palette";
import type { Pixel, Pose } from "./sprites";
import type { Box } from "./winter-terms";

// Paper: "Banner · 煤球的花园 元旦 spec" (New Year's Day · Jan 1).
// All sprites and coordinates are in integer 3 px grid cells.

const rects = (specs: readonly [x: number, y: number, w: number, h: number, key: Key][]): Pixel[] => {
  const out: Pixel[] = [];
  for (const [x, y, w, h, key] of specs) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) out.push([x + dx, y + dy, key]);
    }
  }
  return out;
};

export const PARTY_HAT_TOP: Record<Pose, number> = {
  idle: -2,
  blink: -2,
  walk1: -2,
  walk2: -2,
  happy: -2,
  alert: -1,
  sleep: -1,
};

/** 10 × 6 champagne-gold star party hat (ears stay clear). */
export const PARTY_HAT: Pixel[] = rects([
  [4, 0, 2, 2, "filament"],
  [4, 2, 2, 1, "champagne"],
  [3, 3, 4, 1, "champagne"],
  [4, 3, 2, 1, "mint"],
  [2, 4, 6, 1, "champagne"],
  [3, 4, 1, 1, "dawnCoral"],
  [6, 4, 1, 1, "dawnCoral"],
  [2, 5, 6, 1, "snow"],
  [3, 5, 1, 1, "champagneShade"],
  [6, 5, 1, 1, "champagneShade"],
]);

/** 9 × 9 champagne starburst charm floated on pet. */
export const STARBURST_CHARM: Pixel[] = rects([
  [4, 0, 1, 9, "champagne"],
  [0, 4, 9, 1, "champagne"],
  [3, 2, 3, 5, "champagne"],
  [2, 3, 5, 3, "champagne"],
  [4, 2, 1, 5, "filament"],
  [2, 4, 5, 1, "filament"],
  [3, 3, 3, 3, "filament"],
  [1, 1, 1, 1, "mint"],
  [7, 7, 1, 1, "mint"],
  [7, 1, 1, 1, "dawnCoral"],
]);

const CALENDAR_FRAME: Pixel[] = rects([
  [1, 10, 1, 2, "cord"],
  [10, 10, 1, 2, "cord"],
  [0, 10, 12, 1, "easel"],
  [1, 1, 10, 9, "wood"],
]);

/** Page 31 (curled bottom-right corner). */
const CALENDAR_31: Pixel[] = [
  ...CALENDAR_FRAME,
  ...rects([
    [1, 1, 10, 2, "cord"],
    [3, 0, 1, 2, "champagneShade"],
    [8, 0, 1, 2, "champagneShade"],
    [1, 3, 10, 6, "snow"],
    [1, 9, 8, 1, "snow"],
    [9, 8, 2, 1, "pageFold"],
    [9, 9, 1, 1, "pageFold"],
    // Digit 3
    [2, 4, 3, 1, "pageInk"],
    [4, 5, 1, 1, "pageInk"],
    [3, 6, 2, 1, "pageInk"],
    [4, 7, 1, 1, "pageInk"],
    [2, 8, 3, 1, "pageInk"],
    // Digit 1
    [6, 4, 2, 1, "pageInk"],
    [7, 4, 1, 5, "pageInk"],
    [6, 8, 3, 1, "pageInk"],
  ]),
];

/** Page 01 (mint header + coral accent dot). */
const CALENDAR_01: Pixel[] = [
  ...CALENDAR_FRAME,
  ...rects([
    [1, 1, 10, 2, "mint"],
    [9, 1, 1, 1, "dawnCoral"],
    [3, 0, 1, 2, "champagne"],
    [8, 0, 1, 2, "champagne"],
    [1, 3, 10, 7, "snow"],
    // Digit 0
    [2, 4, 3, 1, "pageInk"],
    [2, 5, 1, 3, "pageInk"],
    [4, 5, 1, 3, "pageInk"],
    [2, 8, 3, 1, "pageInk"],
    // Digit 1
    [6, 4, 2, 1, "pageInk"],
    [7, 4, 1, 5, "pageInk"],
    [6, 8, 3, 1, "pageInk"],
  ]),
];

const TORN_SHEET: Pixel[] = rects([
  [0, 0, 6, 5, "snow"],
  [0, 0, 6, 1, "cord"],
  [2, 2, 2, 1, "zz"],
  [3, 3, 1, 1, "zz"],
]);

const SPARKLER_SMALL: Pixel[] = rects([
  [2, 0, 1, 5, "champagne"],
  [0, 2, 5, 1, "champagne"],
  [2, 2, 1, 1, "filament"],
]);

const SPARKLER_FULL: Pixel[] = rects([
  [6, 0, 1, 4, "champagne"],
  [6, 9, 1, 4, "champagne"],
  [0, 6, 4, 1, "champagne"],
  [9, 6, 4, 1, "champagne"],
  [2, 2, 1, 1, "champagne"],
  [10, 2, 1, 1, "champagne"],
  [2, 10, 1, 1, "champagne"],
  [10, 10, 1, 1, "champagne"],
  [3, 3, 1, 1, "champagne"],
  [9, 3, 1, 1, "champagne"],
  [3, 9, 1, 1, "champagne"],
  [9, 9, 1, 1, "champagne"],
  [6, 4, 1, 5, "filament"],
  [4, 6, 5, 1, "filament"],
  [5, 5, 3, 3, "filament"],
  [4, 2, 1, 1, "mint"],
  [10, 8, 1, 1, "mint"],
  [8, 10, 1, 1, "dawnCoral"],
]);

export const MAX_SPARKLERS = 2;
export const SPARKLER_FOR = 1.4;
export const PAGE_TEAR_FOR = 0.9;

export interface Sparkler {
  x: number;
  y: number;
  born: number;
}

/** 12 × 12 wooden doorstep calendar stand (hx - 14 on narrow layouts). */
export function calendarBox(l: Layout): Box {
  const x = l.fence ? l.bowl - 6 : Math.max(2, l.house.x - 14);
  return { x, y: l.ground - 12, w: 12, h: 12 };
}

/** Launch a sky sparkler (at most 2 active at once). */
export function launchSparkler(current: readonly Sparkler[], l: Layout, x: number, y: number, t: number): Sparkler[] {
  const active = current.filter((s) => t - s.born < SPARKLER_FOR);
  if (active.length >= MAX_SPARKLERS) return active;
  return [
    ...active,
    {
      x: Math.max(8, Math.min(l.w - 9, Math.round(x))),
      y: Math.max(7, Math.min(l.ground - 26, Math.round(y))),
      born: t,
    },
  ];
}

export function newYearDecor(
  l: Layout,
  night: boolean,
  t: number,
  state: { turned: boolean; tearBorn: number | null; sparklers: readonly Sparkler[] },
  still = false,
): Pixel[] {
  const out: Pixel[] = [];
  const put = (dots: readonly Pixel[], ox: number, oy: number) => {
    for (const [x, y, k] of dots) out.push([x + ox, y + oy, k]);
  };
  const G = l.ground;
  const peak = l.house.x + PEAK;
  const rtop = G - ROOF_TOP;
  const phase = still ? 0 : Math.floor(t / 1.2) % 2;
  const bulbKey = (idx: number): Key => {
    if (!night) return "champagneShade";
    if (state.turned) return (idx + phase) % 2 === 0 ? "filament" : "champagne";
    return (idx + phase) % 2 === 0 ? "champagne" : "filament";
  };

  // Fairy string lights draped along tree -> fence (wide screens) and house eaves (always).
  if (l.tree && l.fence) {
    const fx = l.fence.x;
    const fy = G - 10;
    // Tree-to-fence catenary cord.
    for (let i = 0; i < 4; i++) {
      out.push([fx - 9 + i * 2, fy - 10 + i * 2 + (i > 1 ? 1 : 0), "cord"]);
      out.push([fx - 8 + i * 2, fy - 10 + i * 2 + (i > 1 ? 1 : 0), "cord"]);
    }
    for (let x = fx - 1; x < fx + l.fence.w - 2; x++) out.push([x, fy, "cord"]);
    out.push([fx - 8, fy - 9, bulbKey(0)], [fx - 4, fy - 4, bulbKey(1)]);
    for (let i = 0; i < 7; i++) {
      const bx = fx + 3 + i * 6;
      const k = bulbKey(i + 2);
      out.push([bx, fy + 1, k]);
      if (night && state.turned) out.push([bx, fy + 2, "champagne"]);
    }
  }

  // House gable eaves fairy string.
  const eaveStops: [number, number][] = [
    [peak - 17, G - WALL - 2],
    [peak - 14, G - WALL - 4],
    [peak - 10, G - WALL - 6],
    [peak - 6, G - WALL - 8],
    [peak - 2, rtop + 1],
    [peak + 2, rtop + 1],
    [peak + 6, G - WALL - 8],
    [peak + 10, G - WALL - 6],
    [peak + 14, G - WALL - 4],
    [peak + 18, G - WALL - 1],
  ];
  for (let i = 0; i < eaveStops.length; i++) {
    const [ex, ey] = eaveStops[i];
    out.push([ex, ey, "cord"], [ex + 1, ey, "cord"]);
    const k = bulbKey(i);
    out.push([ex, ey + 1, k]);
    if (night && state.turned && i % 2 === 0) out.push([ex, ey + 2, "champagne"]);
  }

  // Tear-off calendar stand (31 or 01).
  const cal = calendarBox(l);
  put(state.turned ? CALENDAR_01 : CALENDAR_31, cal.x, cal.y);

  // Torn old 31 page fluttering down-left over 900 ms.
  if (!still && state.tearBorn !== null) {
    const age = t - state.tearBorn;
    if (age >= 0 && age < PAGE_TEAR_FOR) {
      const p = age / PAGE_TEAR_FOR;
      const sx = Math.round(cal.x - 2 - p * 8);
      const sy = Math.round(cal.y - 6 - Math.sin(p * Math.PI) * 5 + p * 6);
      put(TORN_SHEET, sx, sy);
      out.push([sx - 2, sy + 2, "mint"], [sx + 7, sy + 1, "dawnCoral"]);
    }
  }

  // Resting night confetti dots (reduced motion & ambient).
  if (night) {
    const base = Math.max(4, cal.x - 36);
    out.push([base, G - 1, "mint"], [base + 11, G - 1, "dawnCoral"], [base + 21, G - 2, "champagne"]);
  }

  // Active sparklers + drifting confetti flecks.
  const confettiKeys: Key[] = ["mint", "dawnCoral", "champagne", "mint", "dawnCoral"];
  for (const s of state.sparklers) {
    const age = still ? 0.25 : t - s.born;
    if (age < 0 || age >= SPARKLER_FOR) continue;
    if (night) {
      if (age < 0.14) put(SPARKLER_SMALL, s.x - 2, s.y - 2);
      else if (age < 0.55) put(SPARKLER_FULL, s.x - 6, s.y - 6);
    }
    const drift = Math.max(0, age - (night ? 0.25 : 0));
    const count = night ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const dx = Math.round((hash(i, s.x, 91) - 0.5) * 18);
      const dy = Math.round(drift * 4.5 + hash(i, s.y, 92) * 5);
      const fx = s.x + dx;
      const fy = Math.min(G - 1, s.y + dy);
      out.push([fx, fy, confettiKeys[i % confettiKeys.length]]);
      if (i % 2 === 0) out.push([fx + 1, fy, confettiKeys[i % confettiKeys.length]]);
    }
  }

  return out;
}
