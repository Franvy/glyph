import { type MoonPhase, moonArt } from "./moon";
import type { Key } from "./palette";
import type { Spots } from "./meiqiu";
import type { SceneName } from "./themes";

// The banner is a grid of 3 px cells. Rows count down from the top; `ground` is the first
// soil row, and everything that stands in the garden is placed relative to it.

export const CELL = 3;
const SOIL_ROWS = 11;
/** Below this many cells the tree and fence leave, so 煤球 still has room to walk. */
const ROOMY = 180;
/** Half-width of each roof row, top down: steps of 2, 1, 2, 1 read as one straight gable. */
const ROOF = [4, 6, 7, 9, 10, 12, 13, 15, 16, 18, 19];
/** Wall rows, eaves to grass. */
export const WALL = 16;
/** Ridge column, from the house's left eave. */
export const PEAK = 19;
/** First roof row, from the ground. */
export const ROOF_TOP = WALL + ROOF.length;

export interface Flower {
  x: number;
  stem: number;
  petal: Key;
}

export interface Layout {
  w: number;
  h: number;
  ground: number;
  tree: { x: number } | null;
  fence: { x: number; w: number } | null;
  house: { x: number; w: number; top: number };
  bowl: number;
  cushion: number;
  moon: { x: number; y: number };
  flowers: Flower[];
  spots: Spots;
}

export interface Pixels {
  w: number;
  h: number;
  keys: (Key | null)[];
}

export function gridSize(cssWidth: number, cssHeight: number) {
  return { w: Math.ceil(cssWidth / CELL), h: Math.ceil(cssHeight / CELL) };
}

/** Deterministic noise in 0..1, so the garden looks the same on every visit. */
export function hash(x: number, y: number, seed = 0) {
  let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function layout(w: number, h: number): Layout {
  const ground = h - SOIL_ROWS;
  const roomy = w >= ROOMY;
  const hx = w - 50;
  const left: Flower[] = [
    { x: 40, stem: 5, petal: "g4" },
    { x: 98, stem: 4, petal: "ink" },
    { x: 118, stem: 6, petal: "g4" },
    { x: 146, stem: 5, petal: "pink" },
    { x: 158, stem: 3, petal: "g4" },
  ];
  const flowers = [
    ...left.filter((f) => (roomy || f.x > 60) && f.x < hx - 9).map((f) => (roomy ? f : { ...f, x: f.x - 56 })),
    { x: w - 9, stem: 6, petal: "ink" as Key },
    { x: w - 6, stem: 4, petal: "g4" as Key },
  ];
  const minX = roomy ? 30 : 2;
  return {
    w,
    h,
    ground,
    tree: roomy ? { x: 0 } : null,
    fence: roomy ? { x: 44, w: 47 } : null,
    house: { x: hx, w: 39, top: ground - WALL - ROOF.length - 3 },
    bowl: hx - 6,
    cushion: hx - 34,
    moon: { x: Math.min(Math.round(w * 0.675), hx - 7), y: 11 },
    flowers,
    spots: {
      minX,
      maxX: hx - 15,
      cushion: hx - 34,
      bowl: hx - 6,
      flowers: flowers.filter((f) => f.x < hx).map((f) => f.x - 8),
      butterfly: Math.round(w / 2),
    },
  };
}

const DAYLIGHT: Partial<Record<Key, Key>> & Record<"g1" | "g2" | "g3" | "g4", Key> = { g1: "g4", g2: "g3", g3: "g2", g4: "g1" };

class Canvas {
  keys: (Key | null)[];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.keys = new Array(w * h).fill(null);
  }
  set(x: number, y: number, key: Key | null) {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.keys[y * this.w + x] = key;
  }
  rect(x: number, y: number, w: number, h: number, key: Key) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, key);
  }
}

type Deck = { base: number; amp: number; body: Key; lit: Key; belly: Key };

/** The cloud deck that hides the sky in rain, storm and snow. The storm's hangs lower and darker. */
const DECKS: Partial<Record<SceneName, Deck>> = {
  rain: { base: 5, amp: 4, body: "cloud", lit: "cloudLit", belly: "cloudBelly" },
  snow: { base: 3, amp: 4, body: "cloud", lit: "cloudLit", belly: "cloudBelly" },
  storm: { base: 8, amp: 5, body: "deck", lit: "deckLit", belly: "deckBelly" },
};

/** First row under the deck's belly in column x, or 0 when the sky is open. */
export function deckDepth(scene: SceneName, x: number) {
  const d = DECKS[scene];
  if (!d) return 0;
  // Lobes of uneven width hang from a flat top; the noise keeps their edges ragged.
  const lobe = Math.abs(Math.sin(x / 9 + 0.7)) * 0.6 + Math.abs(Math.sin(x / 23 + 2.1)) * 0.4;
  return Math.round(d.base + d.amp * lobe + hash(x, 0, 11) * 1.5);
}

function paintDeck(c: Canvas, scene: SceneName) {
  const d = DECKS[scene];
  if (!d) return;
  for (let x = 0; x < c.w; x++) {
    const depth = deckDepth(scene, x);
    for (let y = 0; y < depth + 2; y++) {
      let key: Key | null = d.body;
      if (y < 2 && hash(x, y, 12) > 0.72) key = d.lit;
      else if (y >= depth) key = (x + y) % 4 === 0 ? d.belly : null; // the last drops of belly
      else if (y >= depth - 2) key = (x + y) % 2 === 0 ? d.belly : d.body; // dithered belly
      if (key) c.set(x, y, key);
    }
  }
}

/** What snow settles on: the tree, the fence, the roof and its ears, and the grass. */
const SETTLES = new Set<Key>(["g1", "g2", "g3", "g4", "wood", "wood2", "wood3", "roof", "roof2", "ridge"]);

function paintSnow(c: Canvas, l: Layout) {
  const G = l.ground;
  const top = deckDepthMax("snow") + 2;
  for (let x = 0; x < l.w; x++) {
    for (let y = top; y < G; y++) {
      const key = c.keys[y * l.w + x];
      if (key === null || key === "hill" || key.startsWith("star")) continue;
      if (!SETTLES.has(key)) break;
      c.set(x, y, "snow");
      if (y + 1 < G && SETTLES.has(c.keys[(y + 1) * l.w + x]!) && hash(x, y, 13) > 0.55) c.set(x, y + 1, "snowShade");
      break;
    }
    // Drifts bury most of the grass; the soil line turns white with a pale shadow under it.
    if (hash(x, 14) > 0.35) c.set(x, G - 1, "snow");
    c.set(x, G, x % 8 === 7 ? "snowShade" : "snow");
    c.set(x, G + 1, "snowShade");
  }
}

function deckDepthMax(scene: SceneName) {
  const d = DECKS[scene];
  return d ? d.base + d.amp + 2 : 0;
}

/** Puddles in the soil, each with a lit edge where the sky shows in it. */
function paintPuddles(c: Canvas, l: Layout) {
  const G = l.ground;
  for (let i = 0; i < Math.round(l.w / 45); i++) {
    const w = 6 + Math.floor(hash(i, 15) * 6);
    const x = Math.floor(hash(i, 16) * (l.w - w));
    const y = G + 2 + Math.floor(hash(i, 17) * 4);
    c.rect(x + 1, y, w - 2, 1, "puddle");
    c.rect(x, y + 1, w, 1, "puddle");
    c.rect(x + 2, y, 2, 1, "puddleLit");
  }
}

/** 春联 on both sides of the door, the 横批 over it and a 福 turned on its point. */
function paintSpringDoor(c: Canvas, peak: number, G: number) {
  for (let i = -4; i <= 4; i++) c.set(peak + i, G - 15, Math.abs(i) < 4 && i % 2 === 0 ? "gold" : "red");
  c.rect(peak - 4, G - 14, 9, 1, "red");
  for (const side of [-5, 5]) {
    for (let y = G - 13; y <= G - 2; y++) c.set(peak + side, y, (G - 13 - y) % 2 === 0 ? "red" : "brass");
  }
  c.set(peak, G - 10, "red");
  c.rect(peak - 1, G - 9, 3, 1, "red");
  c.rect(peak - 2, G - 8, 5, 1, "red");
  c.set(peak, G - 8, "gold");
  c.rect(peak - 1, G - 7, 3, 1, "red");
  c.set(peak, G - 6, "red");
}

/** Last night's red paper on the grass, seen on the morning of 初一. */
function paintScraps(c: Canvas, l: Layout) {
  for (let i = 0; i < Math.round(l.w / 9); i++) {
    const x = Math.floor(hash(i, 18) * l.w);
    if (x >= l.house.x + 3 && x <= l.house.x + 35) continue;
    c.set(x, l.ground + Math.floor(hash(i, 19) * 3), hash(i, 20) > 0.6 ? "redDark" : "red");
  }
}

/** Major Snow: deep drifts with a 1-cell ice-blue contrast shadow, snow caps, and edge snow clouds. */
function paintMajorSnow(c: Canvas, l: Layout) {
  const G = l.ground;
  for (let x = 0; x < l.w; x++) {
    for (let y = 2; y < G; y++) {
      const key = c.keys[y * l.w + x];
      if (key === null || key === "hill" || key.startsWith("star") || key.startsWith("moon") || key.startsWith("sun")) continue;
      if (!SETTLES.has(key)) break;
      c.set(x, y, "snow");
      if (y + 1 < G && SETTLES.has(c.keys[(y + 1) * l.w + x]!)) c.set(x, y + 1, hash(x, y, 21) > 0.35 ? "snow" : "ice");
      if (y + 2 < G && SETTLES.has(c.keys[(y + 2) * l.w + x]!) && hash(x, y, 22) > 0.55) c.set(x, y + 2, "ice");
      break;
    }
    // Deep snowdrifts across the grass with a crisp 1-cell ice-blue shadow underneath.
    c.set(x, G - 1, "snow");
    c.set(x, G, "snow");
    c.set(x, G + 1, "ice");
  }
  // Thin snow clouds tucked into the upper left and right edges, leaving the moon/sun clear.
  const leftW = Math.min(28, Math.floor(l.w * 0.14));
  const rightW = Math.min(26, Math.floor(l.w * 0.13));
  c.rect(4, 3, leftW, 1, "cloudLit");
  c.rect(2, 4, leftW + 4, 2, "cloud");
  c.rect(l.w - rightW - 6, 4, rightW, 1, "cloudLit");
  c.rect(l.w - rightW - 8, 5, rightW + 4, 2, "cloud");
}

export function chimneyTop(l: Layout) {
  return { x: l.house.x + PEAK + 8, y: l.ground - ROOF_TOP + 2 };
}

/** Winter Solstice: hearth chimney on the right roof slope, plus rime frost on eaves, fence, and night grass tips. */
function paintSolstice(c: Canvas, l: Layout, night: boolean) {
  const G = l.ground;
  // 4 × 5 brick chimney on the right slope with a rime-frosted lip.
  const { x: cx, y: cy } = chimneyTop(l);
  c.rect(cx, cy, 4, 1, "rime");
  c.rect(cx, cy + 1, 4, 4, "brick");
  c.rect(cx, cy + 1, 1, 4, "brickLit");
  // Thin rime on the eaves.
  c.rect(l.house.x, G - WALL - 1, 5, 1, "rime");
  c.rect(l.house.x + l.house.w - 5, G - WALL - 1, 5, 1, "rime");
  if (night) {
    // Rime on fence rails and grass tips.
    if (l.fence) {
      for (let x = l.fence.x; x < l.fence.x + l.fence.w; x += 3) c.set(x, G - 7, "rime");
    }
    for (let x = 0; x < l.w; x += 5) {
      if (x >= l.house.x + 3 && x <= l.house.x + 35) continue;
      if (c.keys[(G - 1) * l.w + x] === "g2" || c.keys[(G - 1) * l.w + x] === "g3") c.set(x, G - 1, "rime");
    }
  } else {
    // Low winter afternoon sun-patch before the doorstep.
    c.rect(Math.max(2, l.bowl - 24), G, 22, 1, "sunPatch");
  }
}

/** Minor Cold: glacial frost on eaves & fence, frozen lawn ice mirror, and daytime sun-patch. */
function paintMinorCold(c: Canvas, l: Layout, night: boolean) {
  const G = l.ground;
  const peak = l.house.x + PEAK;
  // Crisp glacial frost along the roof ridge & eave corners.
  c.rect(peak - 4, G - WALL - ROOF.length, 9, 1, night ? "glacial" : "snow");
  c.rect(l.house.x, G - WALL - 1, 5, 1, night ? "glacial" : "snow");
  c.rect(l.house.x + l.house.w - 5, G - WALL - 1, 5, 1, night ? "glacial" : "snow");
  if (night && l.fence) {
    for (let x = l.fence.x; x < l.fence.x + l.fence.w - 14; x += 6) c.rect(x, G - 9, 3, 1, "glacial");
  }
  // Frozen lawn ice mirror (26 × 3 on wide screens, 14 × 3 below 180 cells).
  const wide = l.fence !== null;
  const mw = wide ? 26 : 14;
  const mx = wide ? Math.max(2, l.bowl - 46) : Math.max(2, l.bowl - 22);
  c.rect(mx, G - 2, mw, 2, "glacialEdge");
  c.rect(mx + 2, G - 3, mw - 4, 1, "glacialEdge");
  c.rect(mx + 2, G - 2, mw - 4, 2, "glacial");
  c.rect(mx + 4, G - 3, mw - 8, 1, "glacial");
  // Specular ice glints.
  c.rect(mx + 5, G - 2, 3, 1, "glint");
  c.rect(mx + 7, G - 3, 2, 1, "glint");
  if (mw >= 20) {
    c.rect(mx + 16, G - 2, 4, 1, "glint");
    c.rect(mx + 19, G - 3, 2, 1, "glint");
  }
  if (!night) {
    c.rect(Math.max(2, l.bowl - 22), G, 18, 1, "sunPatch");
  }
}

/** Major Cold: thick year-end frost crust on roof gable and daytime sun-patch. */
function paintMajorCold(c: Canvas, l: Layout, night: boolean) {
  const G = l.ground;
  const peak = l.house.x + PEAK;
  const rtop = G - WALL - ROOF.length;
  c.rect(peak - 5, rtop - 1, 11, 2, night ? "frostCrust" : "snow");
  c.rect(peak - 4, rtop - 1, 9, 1, night ? "snow" : "frostCrust");
  for (const [dx, dy, w] of [
    [-9, 1, 4], [5, 1, 4], [-13, 3, 4], [9, 3, 4], [-16, 5, 3], [13, 5, 3], [-19, 8, 3], [16, 8, 3],
  ] as const) {
    c.rect(peak + dx, rtop + dy, w, 2, night ? "frostCrust" : "snow");
  }
  if (!night) {
    c.rect(Math.max(2, l.bowl - 24), G, 20, 1, "sunPatch");
  }
}

/** New Year's Day: subtle fallen confetti on the daylight lawn and morning sun-patch. */
function paintNewYear(c: Canvas, l: Layout, night: boolean) {
  const G = l.ground;
  if (!night) {
    c.rect(Math.max(2, l.bowl - 24), G, 20, 1, "sunPatch");
    const spots: [number, Key][] = [
      [l.bowl - 48, "mint"],
      [l.bowl - 37, "dawnCoral"],
      [l.bowl - 25, "mint"],
      [l.bowl - 14, "dawnCoral"],
      [l.bowl - 31, "champagne"],
    ];
    for (const [x, key] of spots) {
      if (x >= 2 && x < l.house.x - 14) c.rect(x, G - 1, 2, 1, key);
    }
  }
}

/** Sun altitude in daylight across the winter arc (18 -> 21 -> 24 -> 22 New Year -> 21 -> 18). */
export function sunAltitude(scene: SceneName): number {
  if (scene === "minor-snow" || scene === "major-cold") return 18;
  if (scene === "major-snow" || scene === "minor-cold") return 21;
  if (scene === "winter-solstice") return 24;
  if (scene === "new-year") return 22;
  return 11;
}

/** Everything that never moves: sky, hills, soil, grass, tree, fence, house, bowl, and what the weather leaves. */
export function paintStatic(l: Layout, night: boolean, scene: SceneName = "clear", phase: MoonPhase = "waningCrescent"): Pixels {
  const c = new Canvas(l.w, l.h);
  const G = l.ground;
  // Rows in the Paper drawing were measured from a ground at 60; this maps them here.
  const r = (y: number) => G + y - 60;
  const decked = scene in DECKS;
  // 除夕 falls on a new moon.
  const moon = !decked && !(scene === "spring" && night);

  if (night && !decked) {
    for (let i = 0; i < Math.round(l.w * 0.27); i++) {
      c.set(Math.floor(hash(i, 1) * l.w), Math.floor(hash(i, 2) * (G - 20)), hash(i, 3) > 0.8 ? "star2" : "star");
    }
    for (const [x, y] of [
      [Math.round(l.w * 0.32), 8],
      [Math.round(l.w * 0.73), 30],
    ]) {
      c.set(x, y, "star3");
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.set(x + dx, y + dy, "star2");
    }
  }

  // By day a round sun; by night tonight's phase (Paper: banner · 月相).
  // Winter solar terms & New Year step the midday sun across the seasonal arc (18 -> 21 -> 24 -> 22 -> 21 -> 18).
  if (moon) {
    const seasonalSun =
      scene === "minor-snow" ||
      scene === "major-snow" ||
      scene === "winter-solstice" ||
      scene === "new-year" ||
      scene === "minor-cold" ||
      scene === "major-cold";
    const cy = night ? l.moon.y : sunAltitude(scene);
    if (!night && scene === "new-year") {
      // Stepped apricot dawn horizon band behind the first sunrise (旦).
      c.rect(Math.max(0, l.moon.x - 24), cy + 6, 48, 2, "dawnBand");
      c.rect(Math.max(0, l.moon.x - 16), cy + 4, 32, 2, "dawnBand");
      c.rect(Math.max(0, l.moon.x - 12), cy + 7, 24, 1, "dawnBandEdge");
    }
    const MOON_KEYS: Record<string, Key> = night
      ? { "#": "moon", "+": "moon2", ".": "moonDark" }
      : scene === "new-year"
        ? { "#": "champagne", "+": "dawnCoral", ".": "filament" }
        : seasonalSun
          ? { "#": "sunGold", "+": "sunEdge", ".": "sunGold" }
          : { "#": "moon", "+": "moon", ".": "moon" };
    const art = moonArt(night ? phase : "full");
    art.forEach((row, j) => [...row].forEach((ch, i) => {
      if (MOON_KEYS[ch]) c.set(l.moon.x - 5 + i, cy - 5 + j, MOON_KEYS[ch]);
    }));
    if (scene === "minor-snow") {
      // Single thin cloud wisp beside the moon / late-autumn sun.
      c.rect(l.moon.x + 2, cy + 2, 9, 1, "cloudLit");
      c.rect(l.moon.x + 1, cy + 3, 12, 1, "cloud");
    }
  }

  for (let x = 0; x < l.w; x++) {
    const top = G - 17 + 5 * Math.sin(x / 23) + 3 * Math.sin(x / 9 + 1.3);
    for (let y = Math.floor(top); y < G; y++) if (y > top + 3 || (x + y) % 2 === 0) c.set(x, y, "hill");
  }

  for (let y = G; y < l.h; y++) {
    for (let x = 0; x < l.w; x++) c.set(x, y, (x + y) % 2 === 0 && hash(x, y, 1) > 0.55 ? "soil2" : "soil");
  }
  c.rect(0, G, l.w, 1, "soilTop");
  for (let i = 0; i < Math.round(l.w / 7); i++) {
    c.set(Math.floor(hash(i, 9) * l.w), G + 2 + Math.floor(hash(i, 8) * (SOIL_ROWS - 3)), "pebble");
  }

  if (l.tree) {
    const blobs = [[24, 24, 15], [14, 30, 9], [34, 30, 10], [20, 16, 9], [30, 17, 8]].map(
      ([x, y, rad]) => [l.tree!.x + x, r(y), rad] as const,
    );
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < 52; x++) {
        if (!blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= br * br)) continue;
        // Lit from the top left, with a 2x2 dither between bands.
        const light = ((16 - x) * 0.6 + (r(14) - y)) / 22 + (hash(x, y, 4) - 0.5) * 0.35;
        const d = (x + y) % 2 === 1;
        const key: Key | null =
          light > 0.55 ? (d || light > 0.8 ? "g4" : "g3") : light > 0.15 ? (d ? "g3" : "g2") : light > -0.3 ? (d ? "g2" : "g1") : d ? "g1" : null;
        // The light theme's scale runs pale to deep, so daylight swaps the bands.
        if (key) c.set(x, y, night ? key : DAYLIGHT[key]);
      }
    }
    const tx = l.tree.x + 22;
    c.rect(tx, r(38), 4, G - r(38), "wood2");
    c.rect(tx, r(38), 1, G - r(38), "wood3");
    c.set(tx - 1, G - 1, "wood2");
    c.set(tx + 4, G - 1, "wood2");
    c.rect(tx + 4, r(42), 3, 1, "wood2");
    c.set(tx + 7, r(41), "wood2");
  }

  if (l.fence) {
    const { x: fx, w: fw } = l.fence;
    for (let x = fx; x < fx + fw - 2; x += 6) {
      c.rect(x, r(51), 3, G - r(51), "wood2");
      c.set(x + 1, r(50), "wood2");
      c.rect(x, r(51), 1, G - r(51), "wood3");
    }
    c.rect(fx, r(53), fw, 1, "wood");
    c.rect(fx, r(57), fw, 1, "wood");
  }

  // House: a home with a straight gable, cat ears on the ridge, a round attic window, one
  // round-topped door with the cat flap and a doorstep. The eaves span house.x .. house.x + 38;
  // the walls sit 3 in.
  const peak = l.house.x + PEAK;
  const top = G - WALL;
  c.rect(peak - 16, top, 33, WALL, "wall");
  c.rect(peak - 16, top, 1, WALL, "wallEdge");
  c.rect(peak + 16, top, 1, WALL, "wallEdge");
  const rtop = top - ROOF.length;
  ROOF.forEach((hw, i) => {
    for (let x = peak - hw; x <= peak + hw; x++) c.set(x, rtop + i, i > 1 && i % 3 === 1 ? "roof2" : "roof");
    for (const d of [hw - 1, hw]) {
      c.set(peak - d, rtop + i, "ridge");
      c.set(peak + d, rtop + i, "ridge");
    }
  });
  c.rect(peak - 4, rtop, 9, 1, "ridge");
  for (const side of [-1, 1]) {
    const ex = peak + side * 4; // middle of the ear's foot; the tip leans out
    c.rect(ex - 1, rtop - 1, 3, 1, "ridge");
    c.rect(side < 0 ? ex - 1 : ex, rtop - 2, 2, 1, "ridge");
    c.set(ex + side, rtop - 3, "ridge");
  }
  c.rect(peak - 2, G - 12, 5, 1, "door"); // round top
  c.rect(peak - 3, G - 11, 7, 11, "door");
  c.set(peak + 1, G - 8, "wood3"); // knob
  c.rect(peak - 2, G - 5, 5, 4, "wallEdge"); // cat flap
  c.rect(peak - 1, G - 4, 3, 3, "door");
  for (const wx of [peak - 13, peak + 9]) {
    c.rect(wx, G - 13, 5, 7, "wallEdge"); // frame; the middle row is the bar between the panes
    c.rect(wx - 1, G - 6, 7, 1, "wood3"); // sill
  }

  // Bowl with a few kibbles (winter solar terms & New Year place their own doorstep prop here).
  if (
    scene !== "minor-snow" &&
    scene !== "major-snow" &&
    scene !== "winter-solstice" &&
    scene !== "new-year" &&
    scene !== "minor-cold" &&
    scene !== "major-cold"
  ) {
    c.rect(l.bowl, G - 3, 8, 1, "wood3");
    c.rect(l.bowl + 1, G - 2, 6, 2, "wood2");
    for (const x of [2, 4, 5]) c.set(l.bowl + x, G - 4, "petalC");
  }

  for (let x = 0; x < l.w; x++) {
    let tall = Math.floor(hash(x, 5) ** 2 * 4);
    if (x >= l.house.x + 3 && x <= l.house.x + 35) tall = 0;
    for (let j = 0; j < tall; j++) c.set(x, G - 1 - j, j === tall - 1 && hash(x, 6) > 0.6 ? "g3" : "g2");
    if (tall && hash(x, 7) > 0.92) c.set(x, G - 1 - tall, "g4");
    c.set(x, G, hash(x, 10) > 0.35 ? "g2" : "soilTop");
  }
  // Paper (House): under the walls the soil line is grass with one dark cell in 5, and a tuft
  // every 7 cells grows in front of the wall, so the home stands on the grass.
  for (let x = peak - 16; x <= peak + 16; x++) c.set(x, G, (x - peak + 22) % 5 === 0 ? "soilTop" : "g2");
  for (const dx of [-15, -8, -1, 6, 13]) c.set(peak + dx, G - 1, "g3");
  c.rect(peak - 4, G, 9, 1, "wood3"); // doorstep

  if (scene === "rain" || scene === "storm") paintPuddles(c, l);
  if (scene === "snow") paintSnow(c, l);
  if (scene === "minor-snow" && !night) {
    // Crisp afternoon sun-patch beside the bamboo drying rack.
    c.rect(Math.max(2, l.bowl - 32), G, 20, 1, "sunPatch");
  }
  if (scene === "major-snow") paintMajorSnow(c, l);
  if (scene === "winter-solstice") paintSolstice(c, l, night);
  if (scene === "new-year") paintNewYear(c, l, night);
  if (scene === "minor-cold") paintMinorCold(c, l, night);
  if (scene === "major-cold") paintMajorCold(c, l, night);
  if (scene === "spring") {
    paintSpringDoor(c, peak, G);
    if (!night) paintScraps(c, l);
  }
  paintDeck(c, scene);

  return { w: l.w, h: l.h, keys: c.keys };
}

/** Windows and attic light, drawn over the static house each frame. */
export function windows(l: Layout, lit: boolean, warm?: "amber" | "cream"): [number, number, Key][] {
  const G = l.ground;
  const peak = l.house.x + PEAK;
  const out: [number, number, Key][] = [];
  const glass: Key = lit ? (warm ?? "lamp") : "lampOff";
  for (const wx of [peak - 13, peak + 9]) {
    for (const y of [G - 12, G - 11, G - 9, G - 8]) for (let i = 0; i < 3; i++) out.push([wx + 1 + i, y, glass]);
    if (lit) out.push([wx + 1, G - 12, "ink"]);
  }
  const cy = G - WALL - ROOF.length + 5;
  for (let y = cy - 2; y <= cy + 2; y++) {
    for (let x = peak - 2; x <= peak + 2; x++) if ((x - peak) ** 2 + (y - cy) ** 2 <= 5) out.push([x, y, glass]);
  }
  return out;
}
