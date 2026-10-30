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
  if (moon) {
    const MOON_KEYS: Record<string, Key> = { "#": "moon", "+": night ? "moon2" : "moon", ".": night ? "moonDark" : "moon" };
    const art = moonArt(night ? phase : "full");
    art.forEach((row, j) => [...row].forEach((ch, i) => {
      if (MOON_KEYS[ch]) c.set(l.moon.x - 5 + i, l.moon.y - 5 + j, MOON_KEYS[ch]);
    }));
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

  // Bowl with a few kibbles.
  c.rect(l.bowl, G - 3, 8, 1, "wood3");
  c.rect(l.bowl + 1, G - 2, 6, 2, "wood2");
  for (const x of [2, 4, 5]) c.set(l.bowl + x, G - 4, "petalC");

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
  if (scene === "spring") {
    paintSpringDoor(c, peak, G);
    if (!night) paintScraps(c, l);
  }
  paintDeck(c, scene);

  return { w: l.w, h: l.h, keys: c.keys };
}

/** Windows and attic light, drawn over the static house each frame. */
export function windows(l: Layout, lit: boolean): [number, number, Key][] {
  const G = l.ground;
  const peak = l.house.x + PEAK;
  const out: [number, number, Key][] = [];
  const glass: Key = lit ? "lamp" : "lampOff";
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
