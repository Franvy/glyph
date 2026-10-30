import type { Spots } from "./meiqiu";
import type { Key } from "./palette";
import { deckDepth, hash, type Layout, PEAK, ROOF_TOP } from "./scene";

// The garden's themes, from the Paper boards "Banner · 煤球的花园 天气 spec" and "… 春节 spec".
// The site theme still decides day or night; a scene only adds a layer. Everything here is a pure
// function of the layout and the time, so the banner can call it every frame and the tests can too.

export const SCENES = ["clear", "cloudy", "rain", "storm", "snow", "fog", "spring"] as const;
export type SceneName = (typeof SCENES)[number];

export const SCENE_LABELS: Record<SceneName, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  rain: "Rain",
  storm: "Storm",
  snow: "Snow",
  fog: "Fog",
  spring: "Lunar New Year",
};

export const nextScene = (s: SceneName): SceneName => SCENES[(SCENES.indexOf(s) + 1) % SCENES.length];

export type Dot = readonly [x: number, y: number, key: Key];

/** Behind 煤球 (clouds, lanterns) and in front of it (rain, snow, fog). `flash` swaps the sky for the storm's. */
export interface Weather {
  back: Dot[];
  front: Dot[];
  flash: boolean;
}

const art = (rows: string[], keys: Record<string, Key>): Dot[] =>
  rows.flatMap((row, y) => [...row].flatMap((c, x) => (keys[c] ? [[x, y, keys[c]] as Dot] : [])));

const CLOUD_KEYS: Record<string, Key> = { L: "cloudLit", C: "cloud", B: "cloudBelly" };
/** The three clouds of the cloudy board: a lit top row, a dithered belly. */
const CLOUDS = [
  {
    top: 3,
    at: 52 / 222,
    dots: art(
      [
        "..........L..........",
        ".......LLLCLLL.......",
        "......LCCCCCCCL......",
        ".....LCCCCCCCCCL.....",
        "...LLCCCCCCCCCCCLL...",
        "..LCCCCCCCCCCCCCCCL..",
        ".LCCCCCCCCCCCCCCCCCL.",
        "LCCCCCCCCCCCCCCCCCCCL",
        ".CBCBCBCBCBCBCBCBCBC.",
        ".BBBBBBBBBBBBBBBBBBB.",
      ],
      CLOUD_KEYS,
    ),
  },
  {
    top: 7,
    at: 143 / 222,
    dots: art(
      [
        "..............L..............",
        "...........LLLCLLL...........",
        "..........LCCCCCCCL..........",
        ".........LCCCCCCCCCL.........",
        "........LCCCCCCCCCCCL........",
        ".....LLLCCCCCCCCCCCCCLLL.....",
        "....LCCCCCCCCCCCCCCCCCCCL....",
        "....CCCCCCCCCCCCCCCCCCCCC....",
        "...LCCCCCCCCCCCCCCCCCCCCCL...",
        ".LLCCCCCCCCCCCCCCCCCCCCCCCLL.",
        ".CBCBCBCBCBCBCBCBCBCBCBCBCBC.",
        "LBBBBBBBBBBBBBBBBBBBBBBBBBBBL",
      ],
      CLOUD_KEYS,
    ),
  },
  {
    top: 19,
    at: 97 / 222,
    dots: art(
      [
        ".......L.......",
        ".....LLCLL.....",
        "...LLCCCCCLL...",
        ".LLCCCCCCCCCLL.",
        ".CCCCCCCCCCCCC.",
        "LCCCCCCCCCCCCCL",
        ".CBCBCBCBCBCBC.",
        ".BBBBBBBBBBBBB.",
      ],
      CLOUD_KEYS,
    ),
  },
];
/** Clouds drift left one cell every 4 s. */
const CLOUD_SPEED = 0.25;

function clouds(l: Layout, t: number): Dot[] {
  const out: Dot[] = [];
  for (const c of CLOUDS) {
    const span = l.w + 30;
    const x0 = ((((Math.round(c.at * l.w) - Math.floor(t * CLOUD_SPEED)) % span) + span) % span) - 30;
    for (const [x, y, k] of c.dots) out.push([x0 + x, c.top + y, k]);
  }
  return out;
}

/** Where no rain falls: under the tree's crown. Null when the banner is too narrow for the tree. */
export function shelter(l: Layout) {
  return l.tree ? { from: l.tree.x + 9, to: l.tree.x + 41, top: l.ground - 21 } : null;
}

/** 煤球 waits out the rain under the tree, or by the house when there is no tree. */
export function sceneSpots(l: Layout, scene: SceneName): Spots {
  if (scene !== "rain" && scene !== "storm") return l.spots;
  const roof = shelter(l);
  const x = roof ? roof.from + 19 : l.spots.maxX;
  return { ...l.spots, minX: x, maxX: x };
}

function rain(l: Layout, scene: "rain" | "storm", t: number): Dot[] {
  const out: Dot[] = [];
  const G = l.ground;
  const roof = shelter(l);
  const eaves = l.house.x;
  const roofTop = G - ROOF_TOP;
  const heavy = scene === "storm";
  const n = Math.round(l.w * (heavy ? 0.4 : 0.22));
  const dry = (x: number, y: number) =>
    (roof !== null && x >= roof.from && x <= roof.to && y >= roof.top) || (x >= eaves && x <= eaves + 38 && y >= roofTop);
  for (let i = 0; i < n; i++) {
    const top = deckDepth(scene, Math.floor(hash(i, 21) * l.w));
    const fall = G - top + 2;
    const speed = (heavy ? 42 : 30) + hash(i, 22) * 10;
    const y = top + Math.floor((hash(i, 23) * fall + t * speed) % fall);
    // Drops lean left: one cell for every three they fall.
    const x = Math.floor(hash(i, 24) * (l.w + fall / 3)) - Math.floor((y - top) / 3);
    const key: Key = hash(i, 25) > 0.4 ? "drop" : "dropFar";
    if (y + 2 < G - 1) {
      for (const [dx, dy] of [[0, 0], [0, 1], [-1, 2]]) if (!dry(x + dx, y + dy)) out.push([x + dx, y + dy, key]);
    } else if (!dry(x, G - 2)) {
      out.push([x - 1, G - 2, "dropFar"], [x + 1, G - 2, "dropFar"], [x, G - 1, "drop"]); // splash
    }
  }
  return out;
}

/** Storm bolts: the first after 3 s, then every 6 to 12 s. */
function lastBolt(t: number) {
  let at = 3;
  let k = 0;
  if (t < at) return null;
  for (;;) {
    const next = at + 6 + 6 * hash(k, 26);
    if (next > t) return { at, k };
    at = next;
    k++;
  }
}

/** The flash lasts 2 frames at 30 fps; the bolt a little longer. */
const FLASH = 2 / 30;
const BOLT = 0.3;

function bolt(l: Layout, k: number): Dot[] {
  const out: Dot[] = [];
  let x = Math.round(l.w * (0.1 + 0.6 * hash(k, 27)));
  let y = deckDepth("storm", x);
  let seg = 0;
  while (y < l.ground) {
    out.push([x, y, "bolt"], [x + 1, y, "boltEdge"]);
    y++;
    if (++seg >= 3 + Math.floor(hash(k, y) * 3)) {
      seg = 0;
      x += hash(k + 1, y) > 0.5 ? 1 : -1;
      out.push([x, y - 1, "bolt"]);
    }
  }
  return out;
}

function snow(l: Layout, t: number): Dot[] {
  const out: Dot[] = [];
  const G = l.ground;
  for (let i = 0; i < Math.round(l.w * 0.14); i++) {
    const top = deckDepth("snow", Math.floor(hash(i, 28) * l.w)) + 1;
    const fall = G - top;
    const y = top + Math.floor((hash(i, 29) * fall + t * (3 + hash(i, 30) * 2)) % fall);
    // Each flake sways one cell, on its own beat.
    const x = Math.floor(hash(i, 31) * l.w) + (Math.sin(t * 1.5 + i) > 0 ? 1 : 0);
    if (hash(i, 32) > 0.6) {
      out.push([x, y, "flake"]);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) out.push([x + dx, y + dy, "flakeArm"]);
    } else out.push([x, y, hash(i, 33) > 0.5 ? "flake" : "flakeArm"]);
  }
  return out;
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Three bands of ordered-dither fog drift right. The one on the grass is the thickest. */
function fog(l: Layout, t: number): Dot[] {
  const out: Dot[] = [];
  const G = l.ground;
  const drift = t * 0.5;
  const bands = [
    { from: 4, to: 13, density: 0.2 },
    { from: G - 39, to: G - 26, density: 0.35 },
    { from: G - 9, to: G + 2, density: 0.55 },
  ];
  bands.forEach((b, i) => {
    for (let y = Math.max(0, b.from); y < b.to; y++) {
      // Thinner at the band's top and bottom rows.
      const edge = Math.min(y - b.from + 1, b.to - y) <= 1 ? 0.6 : 1;
      for (let x = 0; x < l.w; x++) {
        const d = b.density * edge * (0.75 + 0.25 * Math.sin((x - drift) / 13 + i * 2));
        const v = BAYER[y & 3][(x - Math.floor(drift)) & 3];
        if (v < d * 16 - 1.5) out.push([x, y, "fog"]);
        else if (v < d * 16) out.push([x, y, "fogThin"]);
      }
    }
  });
  return out;
}

const LANTERN_LIT = art(["  s  ", " bbb ", "cdddc", "dcdcd", "dcdcd", "cdddc", " bbb ", "  g  ", "  g  "], {
  s: "wood3",
  b: "brass",
  c: "red",
  d: "redLit",
  g: "gold",
});
const LANTERN_OFF = art(["  s  ", " bbb ", "kdddk", "dkdkd", "dkdkd", "kdddk", " bbb ", "  g  ", "  g  "], {
  s: "wood3",
  b: "brass",
  d: "red",
  k: "redDark",
  g: "gold",
});
const SMALL_LIT = art([" s ", " b ", "dkd", "ddd", "dkd", " g "], { s: "wood3", b: "brass", d: "redLit", k: "redDark", g: "gold" });
const SMALL_OFF = art([" s ", " b ", "dkd", "ddd", "dkd", " g "], { s: "wood3", b: "brass", d: "red", k: "redDark", g: "gold" });
/** Lanterns under the eaves and in the tree. They glow by night, rest by day, and sway 1 cell. */
function lanterns(l: Layout, night: boolean, t: number): Dot[] {
  const out: Dot[] = [];
  const G = l.ground;
  const peak = l.house.x + PEAK;
  const sway = (i: number) => (Math.sin(t * 1.6 + i * 1.3) > 0.6 ? 1 : 0);
  const big = night ? LANTERN_LIT : LANTERN_OFF;
  const small = night ? SMALL_LIT : SMALL_OFF;
  [peak - 18, peak + 14].forEach((x, i) => {
    for (const [dx, dy, k] of big) out.push([x + dx + (dy > 1 ? sway(i) : 0), G - 17 + dy, k]);
  });
  if (l.tree) {
    [
      [l.tree.x + 9, G - 21],
      [l.tree.x + 38, G - 20],
    ].forEach(([x, y], i) => {
      for (const [dx, dy, k] of small) out.push([x + dx + (dy > 1 ? sway(i + 2) : 0), y + dy, k]);
    });
  }
  return out;
}

export function weather(l: Layout, scene: SceneName, night: boolean, t: number, still = false): Weather {
  switch (scene) {
    case "cloudy":
      return { back: clouds(l, t), front: [], flash: false };
    case "rain":
      return { back: [], front: rain(l, "rain", t), flash: false };
    case "storm": {
      const b = still ? null : lastBolt(t);
      const age = b ? t - b.at : Infinity;
      return { back: age < BOLT ? bolt(l, b!.k) : [], front: rain(l, "storm", t), flash: age < FLASH };
    }
    case "snow":
      return { back: [], front: snow(l, t), flash: false };
    case "fog":
      return { back: [], front: fog(l, t), flash: false };
    case "spring":
      return { back: lanterns(l, night, t), front: [], flash: false };
    default:
      return { back: [], front: [], flash: false };
  }
}

// ---- 春节: fireworks, 鞭炮 and 红包 ----

export interface Firework {
  x: number;
  y: number;
  born: number;
  color: "red" | "gold" | "g4";
}

/** Seconds a burst takes: open, full, then a fade that droops. */
const OPEN = 0.25;
const FULL = 0.7;
const GONE = 1.6;

/** One burst `t` seconds into the scene: 12 rays, r 4 to 9. */
export function burst(fw: Firework, t: number): Dot[] {
  const a = t - fw.born;
  if (a < 0 || a > GONE) return [];
  const out: Dot[] = [];
  const r = a < OPEN ? 4 + a / OPEN : a < FULL ? 5 + (4 * (a - OPEN)) / (FULL - OPEN) : 9;
  const droop = a < FULL ? 0 : ((a - FULL) / (GONE - FULL)) ** 2 * 3;
  for (let k = 0; k < 12; k++) {
    const ang = (k * Math.PI) / 6 + 0.26;
    const dot = (rad: number, key: Key) =>
      out.push([fw.x + Math.round(Math.cos(ang) * rad), fw.y + Math.round(Math.sin(ang) * rad + droop), key]);
    if (a < FULL) {
      dot(r, fw.color);
      dot(r * 0.6, k % 2 ? "gold" : fw.color);
      if (a >= OPEN) dot(r * 0.3, "red");
    } else {
      // Fading: a scatter of red that thins out frame by frame.
      const frame = Math.floor(a * 10);
      if (hash(k, frame, 34) > (a - FULL) / (GONE - FULL)) dot(r, "red");
      if (hash(k, frame, 35) > 0.5 + (a - FULL) / (GONE - FULL)) dot(r - 3, "red");
    }
  }
  if (a < FULL) {
    out.push([fw.x, fw.y, "spark"]);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) out.push([fw.x + dx, fw.y + dy, "gold"]);
  }
  return out;
}

export const BURST_FOR = GONE;

/** The string of 鞭炮 on the tree: 6 crackers, the fuse at the bottom. `popped` count from the bottom. */
export function crackers(l: Layout, popped: number): Dot[] {
  if (!l.tree) return [];
  const x0 = l.tree.x + 27;
  const y0 = l.ground - 17;
  const out: Dot[] = [];
  for (let y = 0; y < 15; y++) out.push([x0 + 2, y0 + y, "wood3"]);
  // Bottom up: right of the lowest group, then its left, and so on.
  const units = [11, 7, 3].flatMap((g) => [
    [[3, g + 2, "red"], [4, g + 2, "red"], [3, g + 3, "redDark"], [4, g + 3, "brass"]],
    [[0, g, "red"], [1, g, "red"], [0, g + 1, "brass"], [1, g + 1, "redDark"]],
  ]) as [number, number, Key][][];
  units.forEach((unit, i) => {
    if (i < popped) return;
    for (const [x, y, k] of unit) out.push([x0 + x, y0 + y, k]);
  });
  if (popped === 0) out.push([x0 + 2, y0 + 15, "gold"], [x0 + 2, y0 + 16, "brass"]);
  return out;
}

/** Where cracker `i` (bottom up) hangs, to place its sparks and smoke. */
export function crackerAt(l: Layout, i: number) {
  const g = [11, 7, 3][Math.floor(i / 2)];
  const x0 = l.tree!.x + 27;
  return i % 2 === 0 ? { x: x0 + 3, y: l.ground - 17 + g + 2 } : { x: x0, y: l.ground - 17 + g };
}

/** The 鞭炮 hit box, in cells. */
export function crackerBox(l: Layout) {
  return l.tree ? { x: l.tree.x + 26, y: l.ground - 18, w: 7, h: 18 } : null;
}

export const CRACKERS = 6;

/** 5 x 5, floats up in place of the heart. */
export const HONGBAO = art(["kkkkk", "dkkkd", "ddgdd", "ddddd", "ddddd"], { k: "redDark", d: "redLit", g: "gold" });

/** 煤球's red scarf with a gold bell: the body row the scarf wraps, by pose. */
export const SCARF_ROW = { idle: 10, blink: 10, walk1: 10, walk2: 10, happy: 10, alert: 11, sleep: 11 } as const;
