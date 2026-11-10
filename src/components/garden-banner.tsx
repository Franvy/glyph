import { useEffect, useRef } from "react";
import { CANDY, decorations, ghostFrame, HAT_TOP, pumpkinBoxes, summonGhost, WITCH_HAT, type Ghost } from "@/lib/garden/halloween";
import { burstSound, dropSound, lampSound, petSound, popSound, skySound, yarnSound } from "@/components/garden-sound";
import { type Cat, newCat, poseOf, rainWalk, step } from "@/lib/garden/meiqiu";
import { tonightsPhase } from "@/lib/garden/moon";
import { type Key, PALETTES } from "@/lib/garden/palette";
import { type Layout, CELL, gridSize, layout, paintStatic, PEAK, windows } from "@/lib/garden/scene";
import { panAt, petCue, skyCue } from "@/lib/garden/sounds";
import { BUTTERFLY, FEET, HEART, POSES, RAIN_UMBRELLA, type Pixel, type Pose, ZED_BIG, ZED_SMALL } from "@/lib/garden/sprites";
import { gardenRituals, RITUAL_HEIGHT, RITUAL_WIDTH, ritualArt, ritualFrame, type GardenRitual } from "@/lib/meiqiu-rituals";
import {
  BURST_FOR,
  burst,
  CRACKERS,
  crackerAt,
  crackerBox,
  crackers,
  type Firework,
  HONGBAO,
  SCARF_ROW,
  type SceneName,
  sceneSpots,
  weather,
} from "@/lib/garden/themes";

type Theme = "dark" | "light";

const MAX_FIREFLIES = 12;
const MAX_PRINTS = 40;
/** Two bursts at most at one time. */
const MAX_BURSTS = 2;
/** A new scene comes in through an ordered dither: 8 steps, 50 ms each. */
const FADE_STEPS = 8;
const FADE_STEP = 0.05;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

interface Firefly {
  x: number;
  y: number;
  phase: number;
}
interface Heart {
  x: number;
  y: number;
  age: number;
}
interface Yarn {
  x: number;
  from: number;
  to: number;
  t: number;
}
/** A firework on its way up: it bursts at `toY`. */
interface Trail {
  x: number;
  y: number;
  toY: number;
  color: Firework["color"];
  /** Launched by a click: only these whistle and boom. */
  heard: boolean;
}
/** Something that falls and maybe stays: red paper, or a raindrop dropped by a click. */
interface Bit {
  x: number;
  y: number;
  rest: number;
  key: Key;
}
/** A short-lived puff: sparks and smoke from the 鞭炮. */
interface Puff {
  x: number;
  y: number;
  age: number;
  smoke: boolean;
}

type GardenActivity = { id: GardenRitual; image: HTMLImageElement; at: number; frame: number };

const FOOTING: Record<GardenRitual, { bodyX: number; groundY: number }> = {
  hike: { bodyX: 11, groundY: 20 },
  water: { bodyX: 5, groundY: 22 },
  fish: { bodyX: 5, groundY: 21 },
  nap: { bodyX: 8, groundY: 21 },
  kite: { bodyX: 8, groundY: 21 },
  stars: { bodyX: 8, groundY: 21 },
  snow: { bodyX: 8, groundY: 21 },
};

function drawActivity(ctx: CanvasRenderingContext2D, activity: GardenActivity, cat: Cat, l: Layout) {
  const { id, image, frame } = activity;
  const { bodyX, groundY } = FOOTING[id];
  const flip = id === "hike" && cat.dir === 1;
  const anchor = flip ? RITUAL_WIDTH - bodyX - 12 : bodyX;
  const x = Math.round(cat.x) + 1 - anchor;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (id === "stars") {
    // The second strip keeps the stars and meteor in the existing sky, clear of the cat.
    const skyX = Math.round(l.w * 0.48) - RITUAL_WIDTH / 2;
    ctx.drawImage(image, frame * RITUAL_WIDTH, RITUAL_HEIGHT, RITUAL_WIDTH, RITUAL_HEIGHT, skyX, 6, RITUAL_WIDTH, RITUAL_HEIGHT);
  }
  ctx.translate(x + (flip ? RITUAL_WIDTH : 0), l.ground - groundY);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(image, frame * RITUAL_WIDTH, 0, RITUAL_WIDTH, RITUAL_HEIGHT, 0, 0, RITUAL_WIDTH, RITUAL_HEIGHT);
  ctx.restore();
}

/** Everything the loop mutates. Kept out of React state: it changes 60 times a second. */
interface Garden {
  l: Layout;
  scene: SceneName;
  bg: HTMLCanvasElement;
  flashBg: HTMLCanvasElement | null;
  cat: Cat;
  rainWalkAt: number | null;
  rainWalkDone: boolean;
  activity: GardenActivity | null;
  seenActivities: Set<GardenRitual>;
  nextActivityAt: number;
  yarn: Yarn;
  fireflies: Firefly[];
  hearts: Heart[];
  sway: Map<number, number>;
  pointer: { x: number; y: number } | null;
  overCat: boolean;
  overHouse: boolean;
  pounce: number | null;
  pets: number;
  time: number;
  prints: number[];
  lastPrint: number;
  fireworks: Firework[];
  trails: Trail[];
  nextLaunch: number;
  popped: number;
  nextPop: number | null;
  puffs: Puff[];
  bits: Bit[];
  fade: { from: ImageData; age: number } | null;
  pumpkinLit: boolean;
  ghost: Ghost | null;
  lastTreat: number;
  petUntil: number;
  blinkUntil: number;
  targetSize: number;
}

const nightOf = (theme: Theme) => theme === "dark";

function hits(g: Garden) {
  const p = g.pointer;
  const { l, cat } = g;
  if (!p) return { cat: false, pumpkin: false, house: false, grass: false, sky: false, crackers: false };
  const inside = (x: number, y: number, w: number, h: number) => {
    const px = Math.max(0, (g.targetSize - w) / 2);
    const py = Math.max(0, (g.targetSize - h) / 2);
    return p.x >= x - px && p.x <= x + w + px && p.y >= y - py && p.y <= y + h + py;
  };
  const onCat = g.scene !== "storm" && inside(cat.x, l.ground - 14, 16, 14);
  const onPumpkin = g.scene === "halloween" && !onCat && pumpkinBoxes(l).some((b) => inside(b.x, b.y, b.w, b.h));
  const onHouse = !onCat && !onPumpkin && inside(l.house.x, l.house.top, l.house.w, l.ground - l.house.top);
  const box = g.scene === "spring" && g.popped < CRACKERS ? crackerBox(l) : null;
  const onCrackers = !!box && inside(box.x, box.y, box.w, box.h);
  return {
    cat: onCat,
    pumpkin: onPumpkin,
    house: onHouse,
    grass: !onCat && !onPumpkin && !onHouse && p.y >= l.ground - 8,
    sky: !onCat && !onPumpkin && !onHouse && p.y < l.ground - 18,
    crackers: onCrackers,
  };
}

function paintBackground(l: Layout, theme: Theme, scene: SceneName, flash = false) {
  const pixels = paintStatic(l, nightOf(theme), scene, tonightsPhase(new Date()));
  const canvas = document.createElement("canvas");
  canvas.width = l.w;
  canvas.height = l.h;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(l.w, l.h);
  const palette = PALETTES[theme];
  const sky: Key = flash ? "flash" : "bg";
  pixels.keys.forEach((key, i) => {
    const n = Number.parseInt(palette[key ?? sky].slice(1), 16);
    image.data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i * 4);
  });
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function draw(ctx: CanvasRenderingContext2D, g: Garden, theme: Theme, pose: Pose, lit: boolean, still: boolean) {
  const { l, cat, time, scene } = g;
  const palette = PALETTES[theme];
  const night = nightOf(theme);
  const G = l.ground;
  const put = (x: number, y: number, key: Key) => {
    ctx.fillStyle = palette[key];
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const sprite = (pixels: readonly (Pixel | readonly [number, number, Key])[], ox: number, oy: number, flip = false, width = 16) => {
    for (const [x, y, key] of pixels) put(ox + (flip ? width - 1 - x : x), oy + y, key);
  };
  // Drops and flakes stand still for visitors who asked for less motion.
  const sky = weather(l, scene, night, still ? 2 : time, still);

  ctx.drawImage(sky.flash && g.flashBg ? g.flashBg : g.bg, 0, 0);

  // Rain lights the lamps, by day too. In a storm 煤球 hides indoors: two eyes in the dark left window.
  const peak = l.house.x + PEAK;
  const windowLights = () => {
    for (const [x, y, key] of windows(l, lit || scene === "rain" || scene === "storm")) put(x, y, key);
    if (scene === "storm") {
      const wx = peak - 13;
      for (const y of [G - 12, G - 11, G - 9, G - 8]) for (let i = 1; i <= 3; i++) put(wx + i, y, "door");
      if (time % 4 < 3.85) for (const x of [wx + 1, wx + 3]) put(x, G - 11, "eye");
    }
  };
  windowLights();

  sprite(sky.back, 0, 0, false, 0);
  if (scene === "halloween") sprite(decorations(l, night, time, g.pumpkinLit, still), 0, 0);

  if (scene === "spring") {
    sprite(crackers(l, g.popped), 0, 0, false, 0);
    for (const t of g.trails) {
      put(t.x, t.y, "spark");
      for (let i = 1; i <= 3; i++) put(t.x, t.y + i * 2, i === 1 ? "gold" : "brass");
    }
    for (const fw of g.fireworks) sprite(burst(fw, time), 0, 0, false, 0);
    // Reduced motion: one burst, at its full stage.
    if (still && night) sprite(burst({ x: Math.round(l.w * 0.42), y: 14, born: 0, color: "red" }, 0.6), 0, 0, false, 0);
  }

  // Flowers lean one cell while something brushes past them.
  for (const f of l.flowers) {
    const lean = (g.sway.get(f.x) ?? 0) > 0 ? (Math.floor(time * 6) % 2 === 0 ? 1 : -1) : 0;
    const top = G - 1 - f.stem;
    for (let j = 1; j <= f.stem; j++) put(f.x + (j < 3 ? lean : 0), top + j, "g2");
    put(f.x + 1, top + Math.floor(f.stem / 2) + 1, "g3");
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(f.x + lean + dx, top + dy, f.petal);
    put(f.x + lean, top, "petalC");
  }

  // Yarn: a 6-cell ball whose strands turn as it rolls, and a thread behind it.
  const yx = Math.round(g.yarn.x);
  const yy = G - 6;
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if ((x - 2.5) ** 2 + (y - 2.5) ** 2 <= 8) put(yx + x, yy + y, "g3");
  const turn = Math.floor(g.yarn.x / 2) % 2;
  for (const [x, y] of turn ? [[1, 1], [2, 2], [3, 3], [4, 2], [1, 4]] : [[4, 1], [3, 2], [2, 3], [1, 2], [4, 4]]) put(yx + x, yy + y, "g4");
  const away = g.yarn.to >= g.yarn.from ? -1 : 1;
  for (let i = 0; i < 10; i++) put(yx + (away < 0 ? -1 - i : 6 + i), G - 1 - (i % 4 === 1 || i % 4 === 2 ? 1 : 0), "g4");

  if ((night && (scene === "clear" || scene === "cloudy")) || scene === "halloween") {
    for (const f of g.fireflies) {
      if (Math.sin(time * 2 + f.phase) < -0.3) continue;
      const x = f.x + Math.sin(time * 0.5 + f.phase) * 4;
      const y = f.y + Math.cos(time * 0.7 + f.phase) * 3;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(x + dx, y + dy, "halo");
      put(x, y, "g4");
    }
  }

  if (scene === "clear" || scene === "cloudy" || scene === "fog" || scene === "spring") {
    const bx = l.spots.butterfly;
    const by = Math.max(6, G - 30 + Math.sin(time * 1.3) * 6);
    sprite(BUTTERFLY[Math.floor(time * 5) % 2], bx, by, false, 5);
  }

  for (const x of g.prints) {
    put(x, G, "snowShade");
    put(x + 2, G, "snowShade");
  }

  const lift = cat.mode === "sleep" ? 2 : 0;
  const oy = G - FEET[pose] - lift;
  if (g.activity) drawActivity(ctx, g.activity, cat, l);
  else if (scene !== "storm") {
    if (cat.mode === "sleep") {
      const cx = Math.round(cat.x);
      ctx.fillStyle = palette.pink;
      ctx.fillRect(cx, G - 2, 17, 1);
      ctx.fillRect(cx - 1, G - 1, 19, 1);
      ctx.fillStyle = palette.cushion;
      ctx.fillRect(cx, G - 1, 17, 1);
    }
    const walk = !still && scene === "rain" && g.rainWalkAt !== null
      ? rainWalk(time - g.rainWalkAt, Math.max(l.spots.minX, sceneSpots(l, scene).minX), l.spots.minX, l.spots.maxX)
      : null;
    if (walk) {
      const x = Math.round(walk.puddleX);
      ctx.fillStyle = palette.puddle;
      ctx.fillRect(x - 7, G, 15, 2);
      ctx.fillStyle = palette.puddleLit;
      ctx.fillRect(x - 4, G, 8, 1);
      if (walk.splash) {
        for (const dx of [-8, -6, 6, 8]) put(x + dx, G - (Math.abs(dx) === 8 ? 2 : 4), "drop");
        put(x + 8, G - 3, "gold");
        put(x + 9, G - 3, "brass");
        for (let dx = 5; dx < 10; dx++) put(x + dx, G - 2, "gold");
      }
    }
    sprite(POSES[pose], Math.round(cat.x), oy, cat.dir === 1);
    if (walk) sprite(RAIN_UMBRELLA, Math.round(cat.x), G - 21, cat.dir === 1);
    if (scene === "spring") {
      // A red scarf with a gold bell.
      const r = SCARF_ROW[pose];
      const scarf: Pixel[] = [];
      for (let x = 1; x <= 12; x++) scarf.push([x, r, "red"]);
      scarf.push([6, r + 1, "gold"], [11, r + 1, "red"]);
      sprite(scarf, Math.round(cat.x), oy, cat.dir === 1);
    }
    if (scene === "halloween") sprite(WITCH_HAT, Math.round(cat.x) + 2, oy + HAT_TOP[pose], cat.dir === 1, 12);
    if (cat.mode === "sleep") {
      const rise = (time * 2) % 6;
      sprite(ZED_BIG, cat.x + 13, oy - 2 - Math.floor(rise / 2), false, 3);
      if (rise > 2) sprite(ZED_SMALL, cat.x + 17, oy - 6 - Math.floor(rise / 3), false, 2);
    }
  }
  for (const h of g.hearts) {
    if (scene === "halloween") {
      ctx.globalAlpha = still ? 1 : Math.min(1, (0.8 - h.age) / 0.3);
      sprite(CANDY, h.x - 2, h.y - (still ? 0 : Math.floor(h.age / 0.8 * 6)), false, 9);
      ctx.globalAlpha = 1;
      continue;
    }
    if (h.age > 0.9 && Math.floor(h.age * 10) % 2 === 0) continue;
    const y = h.y - h.age * 5;
    if (scene === "spring") {
      // A 红包 in place of the heart, with two gold sparks.
      sprite(HONGBAO, h.x, y, false, 5);
      if (Math.floor(h.age * 8) % 2 === 0) {
        put(h.x - 2, y + 1, "gold");
        put(h.x + 6, y - 1, "gold");
      }
    } else sprite(HEART, h.x, y, false, 5);
  }

  if (scene === "halloween" && g.ghost) {
    const frame = ghostFrame(g.ghost, time, still);
    ctx.globalAlpha = frame.opacity;
    sprite(frame.dots, 0, 0);
    ctx.globalAlpha = 1;
  }

  for (const p of g.puffs) {
    if (p.smoke) {
      const r = 1 + Math.floor(p.age * 6);
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [-1, -r - 1], [1, -r]]) put(p.x + dx, p.y + dy - p.age * 6, "smoke");
    } else {
      for (const [dx, dy] of [[-1, -1], [1, -1], [-2, 1], [2, 0], [0, -2]]) put(p.x + dx * (1 + p.age * 8), p.y + dy, p.age < 0.08 ? "spark" : "gold");
    }
  }
  for (const b of g.bits) {
    put(b.x, b.y, b.key);
    if (b.key === "drop") {
      put(b.x, b.y + 1, "drop");
      put(b.x - 1, b.y + 2, "drop");
    }
  }

  sprite(sky.front, 0, 0, false, 0);

  // At night only the windows and 煤球's eyes come through the fog.
  if (scene === "fog" && night) {
    windowLights();
    sprite(POSES[pose].filter(([, , k]) => k === "eye"), Math.round(cat.x), oy, cat.dir === 1);
  } else if (scene === "fog") {
    // By day 煤球 stays visible, only its feet in the fog.
    sprite(POSES[pose].filter(([, y]) => y < FEET[pose] - 2), Math.round(cat.x), oy, cat.dir === 1);
  }
}

/** Overlays the old scene where the dither has not reached yet. */
function dither(ctx: CanvasRenderingContext2D, from: ImageData, step: number) {
  const { width: w, height: h } = ctx.canvas;
  if (from.width !== w || from.height !== h) return;
  const now = ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (BAYER[y & 3][x & 3] < step * 2) continue;
      const i = (y * w + x) * 4;
      now.data.set(from.data.subarray(i, i + 4), i);
    }
  }
  ctx.putImageData(now, 0, 0);
}

/** 煤球's garden: a pixel scene in the site's blues that 煤球 wanders around, in one of eight themes. */
export function GardenBanner({ theme, still, scene = "clear", windy = false }: {
  theme: Theme;
  still: boolean;
  scene?: SceneName;
  windy?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Survives a theme or scene switch, so 煤球 keeps walking where it was.
  const gardenRef = useRef<Garden | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    let g: Garden | null = gardenRef.current;
    const night = nightOf(theme);
    const activities = still ? [] : gardenRituals(scene, night, windy);
    const activityImages = new Map(activities.map((id) => {
      const image = new Image();
      image.src = ritualArt(id);
      return [id, image];
    }));

    const build = () => {
      const { w, h } = gridSize(wrap.clientWidth, wrap.clientHeight);
      if (!w || !h) return;
      const l = layout(w, h);
      const sameScene = g?.scene === scene ? g : null;
      const sameWidth = sameScene?.l.w === w ? sameScene : null;
      const fade =
        g && g.scene !== scene && !still && canvas.width === w && canvas.height === h
          ? { from: ctx.getImageData(0, 0, w, h), age: 0 }
          : null;
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w * CELL}px`;
      canvas.style.height = `${h * CELL}px`;
      const startX = still ? l.spots.cushion : Math.round((l.spots.minX + l.spots.maxX) / 2);
      g = {
        l,
        scene,
        bg: paintBackground(l, theme, scene),
        flashBg: scene === "storm" ? paintBackground(l, theme, scene, true) : null,
        cat: still ? { ...newCat(startX), mode: "sleep", timer: Infinity } : (g?.cat ?? newCat(startX)),
        rainWalkAt: still ? null : (sameWidth?.rainWalkAt ?? null),
        rainWalkDone: sameScene?.rainWalkDone ?? false,
        activity: sameWidth?.activity && activities.includes(sameWidth.activity.id) ? sameWidth.activity : null,
        seenActivities: sameScene?.seenActivities ?? new Set(),
        nextActivityAt: sameScene?.nextActivityAt ?? (g?.time ?? 0) + 1.5,
        yarn: g?.yarn ?? { x: l.bowl - 34, from: l.bowl - 34, to: l.bowl - 34, t: 1 },
        fireflies:
          (scene === "halloween" && !night ? [] : sameScene?.fireflies) ??
          [0.27, 0.68, 0.16, 0.45, 0.94].map((fx, i) => ({ x: Math.round(w * fx), y: l.ground - [23, 25, 29, 41, 43][i], phase: i * 1.7 })),
        hearts: [],
        sway: new Map(),
        pointer: null,
        overCat: false,
        overHouse: false,
        pounce: null,
        pets: g?.pets ?? 0,
        time: g?.time ?? 0,
        // Keep ground marks when redrawing the same scene at the same width.
        prints: sameWidth?.prints ?? [],
        lastPrint: sameWidth?.lastPrint ?? -1,
        fireworks: [],
        trails: [],
        nextLaunch: (g?.time ?? 0) + 1.5,
        popped: sameScene?.popped ?? 0,
        nextPop: null,
        puffs: [],
        bits: sameWidth?.bits.filter((b) => b.key !== "drop") ?? [],
        fade: still ? null : (fade ?? sameScene?.fade ?? null),
        pumpkinLit: night,
        ghost: null,
        lastTreat: -Infinity,
        petUntil: 0,
        blinkUntil: 0,
        targetSize: 0,
      };
      g.cat = { ...g.cat, x: Math.min(g.cat.x, l.spots.maxX) };
      gardenRef.current = g;
      g.yarn.x = Math.min(g.yarn.x, l.spots.maxX);
    };

    const render = () => {
      if (!g) return;
      const hit = hits(g);
      let cat = g.cat;
      if (still) cat = { ...cat, mode: hit.cat ? "happy" : cat.mode };
      if (scene === "halloween" && g.time < g.petUntil) cat = { ...cat, mode: "happy" };
      let pose = poseOf(cat, g.time);
      if (scene === "snow" && (pose === "idle" || pose === "blink")) pose = "happy"; // 煤球 loves snow
      if (scene === "halloween" && g.time < g.blinkUntil) pose = "blink";
      draw(ctx, { ...g, cat }, theme, pose, hit.house, still);
      if (g.fade) {
        const stepNo = Math.floor(g.fade.age / FADE_STEP) + 1;
        if (stepNo >= FADE_STEPS) g.fade = null;
        else dither(ctx, g.fade.from, stepNo);
      }
      canvas.dataset.pumpkinLit = String(g.pumpkinLit);
      canvas.dataset.ghost = String(!!g.ghost && (still || g.time - g.ghost.born < 1.6));
      wrap.querySelector('[data-garden-action="pumpkin"]')?.setAttribute("aria-pressed", String(g.pumpkinLit));
      canvas.dataset.catX = String(Math.round((g.cat.x + 8) * CELL));
      canvas.dataset.catY = String(Math.round((g.l.ground - 6) * CELL));
      if (g.activity) {
        canvas.dataset.activity = g.activity.id;
        canvas.dataset.activityFrame = String(g.activity.frame);
      } else {
        delete canvas.dataset.activity;
        delete canvas.dataset.activityFrame;
      }
      canvas.dataset.catMode = scene === "storm" ? "hidden" : cat.mode;
    };

    /** False when two bursts are already up. */
    const launch = (x: number, toY: number, heard = false) => {
      if (!g || g.fireworks.length + g.trails.length >= MAX_BURSTS) return false;
      const colors: Firework["color"][] = ["red", "gold", "g4"];
      g.trails.push({ x: Math.round(x), y: g.l.ground - 2, toY: Math.round(toY), color: colors[Math.floor(Math.random() * 3)], heard });
      return true;
    };

    const updateActivity = (g: Garden, dt: number, interrupted: boolean) => {
      if (g.activity) {
        const frame = ritualFrame(g.activity.id, g.time - g.activity.at);
        if (interrupted || frame === null) {
          g.activity = null;
          g.nextActivityAt = g.time + 6;
          g.cat = { ...g.cat, mode: "sit", timer: 1.5 };
        } else {
          g.activity.frame = frame;
          if (g.activity.id === "hike") {
            const { minX, maxX } = g.l.spots;
            const x = Math.max(minX, Math.min(maxX, g.cat.x + g.cat.dir * 7 * dt));
            g.cat = { ...g.cat, x };
          }
        }
      }
      if (interrupted || g.activity || g.time < g.nextActivityAt || g.cat.mode !== "sit" || g.cat.goal === "yarn") return;
      const id = activities.find((id) => {
        const image = activityImages.get(id);
        return !g.seenActivities.has(id) && !!image?.naturalWidth;
      });
      if (!id) return;
      const image = activityImages.get(id)!;
      g.activity = { id, image, at: g.time, frame: 0 };
      g.seenActivities.add(id);
      if (id === "hike") {
        const { minX, maxX } = g.l.spots;
        g.cat = { ...g.cat, dir: maxX - g.cat.x > g.cat.x - minX ? 1 : -1 };
      }
    };

    const tick = (dt: number) => {
      if (!g) return;
      g.time += dt;
      if (g.fade) g.fade.age += dt;
      const hit = hits(g);
      const { l } = g;
      const w = l.w;
      const pan = (x: number) => panAt(x, w);
      if (hit.cat && !g.overCat) pet();
      g.overCat = hit.cat;
      // The lamps click on, unless rain has lit them already.
      if (hit.house && !g.overHouse && scene !== "rain" && scene !== "storm") lampSound(pan(l.house.x + l.house.w / 2));
      g.overHouse = hit.house;
      l.spots.butterfly = Math.round(w / 2 + Math.sin(g.time * 0.4) * w * 0.3);

      // In rain, take one short walk after reaching shelter. A pet or yarn throw interrupts it.
      const rainy = scene === "rain" || scene === "storm";
      const shelterX = Math.max(l.spots.minX, sceneSpots(l, scene).minX);
      const sheltered = rainy && Math.abs(g.cat.x - shelterX) < 1 && g.cat.goal !== "yarn";
      const hoverCat = hit.cat || g.time < g.petUntil;
      updateActivity(g, dt, hoverCat || hit.house || g.pounce !== null);
      if (scene === "rain" && sheltered && g.cat.mode === "sit" && !hoverCat && g.pounce === null && !g.rainWalkDone) {
        g.rainWalkAt = g.time;
        g.rainWalkDone = true;
      }
      const walk = g.rainWalkAt !== null && !hoverCat && g.pounce === null
        ? rainWalk(g.time - g.rainWalkAt, shelterX, l.spots.minX, l.spots.maxX)
        : null;
      if (walk) {
        g.cat = {
          ...g.cat,
          x: walk.x,
          dir: walk.dir,
          mode: walk.paused ? "sit" : "walk",
          target: shelterX,
          clock: g.cat.clock + dt,
        };
      } else if (!g.activity) {
        g.rainWalkAt = null;
        if (rainy && g.cat.goal === "yarn" && g.cat.mode === "sit") g.cat = { ...g.cat, goal: "wander" };
        const spots = sheltered && g.pounce === null ? { ...l.spots, minX: shelterX, maxX: shelterX } : l.spots;
        if (rainy && !sheltered && g.cat.goal !== "yarn" &&
          (g.cat.mode === "sit" || g.cat.mode === "sleep" || (g.cat.mode === "walk" && g.cat.target !== shelterX))) {
          g.cat = { ...g.cat, mode: "walk", goal: "wander", target: shelterX };
        }
        g.cat = step(g.cat, dt, { hoverCat, hoverHouse: hit.house && !rainy, pounce: g.pounce, spots }, Math.random);
      }
      g.pounce = null;

      if (scene === "snow" && (g.cat.mode === "walk" || g.cat.mode === "chase")) {
        const x = Math.round(g.cat.x) + (g.cat.dir === 1 ? 3 : 10);
        if (Math.abs(x - g.lastPrint) >= 4) {
          g.prints = [...g.prints, x].slice(-MAX_PRINTS);
          g.lastPrint = x;
        }
      }

      if (scene === "spring") {
        // 鞭炮: one cracker every 2 frames, from the bottom up. 煤球 runs to the house side.
        if (hit.crackers && g.nextPop === null && g.popped < CRACKERS) {
          g.nextPop = g.time;
          g.cat = { ...g.cat, mode: "chase", goal: "wander", target: l.spots.maxX, dir: 1 };
        }
        while (g.nextPop !== null && g.time >= g.nextPop) {
          const at = crackerAt(l, g.popped);
          g.puffs.push({ ...at, age: 0, smoke: false }, { ...at, age: 0, smoke: true });
          popSound(pan(at.x));
          for (let i = 0; i < 3; i++) {
            g.bits.push({ x: at.x + Math.round((Math.random() - 0.5) * 10), y: at.y, rest: l.ground + Math.floor(Math.random() * 3), key: i ? "red" : "redDark" });
          }
          g.popped++;
          g.nextPop = g.popped < CRACKERS ? g.nextPop + 2 / 30 : null;
        }
        if (night && g.time >= g.nextLaunch) {
          launch(w * (0.12 + Math.random() * 0.5), 8 + Math.random() * (l.ground - 48));
          g.nextLaunch = g.time + 4 + Math.random() * 3;
        }
        for (const t of g.trails) t.y -= dt * 60; // 2 cells a frame
        for (const t of g.trails.filter((t) => t.y <= t.toY)) {
          g.fireworks.push({ x: t.x, y: t.toY, born: g.time, color: t.color });
          if (t.heard) burstSound(pan(t.x));
        }
        g.trails = g.trails.filter((t) => t.y > t.toY);
        g.fireworks = g.fireworks.filter((f) => g!.time - f.born < BURST_FOR);
      }
      g.puffs = g.puffs.map((p) => ({ ...p, age: p.age + dt })).filter((p) => p.age < (p.smoke ? 0.5 : 0.15));
      for (const b of g.bits) if (b.y < b.rest) b.y = Math.min(b.rest, b.y + dt * (b.key === "drop" ? 30 : 14));
      for (const b of g.bits) if (b.key === "drop" && b.y >= b.rest) dropSound(pan(b.x));
      g.bits = g.bits.filter((b) => b.key !== "drop" || b.y < b.rest);

      const y = g.yarn;
      if (y.t < 1) {
        y.t = Math.min(1, y.t + dt / 0.8);
        y.x = y.from + (y.to - y.from) * (1 - (1 - y.t) ** 3);
      }
      g.hearts = g.hearts.map((h) => ({ ...h, age: h.age + dt })).filter((h) => h.age < (scene === "halloween" ? 0.8 : 1.2));
      for (const f of l.flowers) {
        const near = Math.abs(g.cat.x + 8 - f.x) < 4 && g.cat.mode !== "sit";
        const left = Math.max(0, (g.sway.get(f.x) ?? 0) - dt);
        g.sway.set(f.x, near ? 0.4 : left);
      }
    };

    const pet = () => {
      if (!g) return;
      const now = performance.now() / 1000;
      if (scene === "halloween" && now - g.lastTreat < 1) return;
      g.lastTreat = now;
      g.pets++;
      if (scene === "halloween") {
        g.petUntil = g.time + 0.8;
        g.blinkUntil = 0;
        g.cat = { ...g.cat, mode: "happy", timer: 0.8 };
      }
      g.hearts = [...g.hearts, { x: g.cat.x + 6, y: g.l.ground - (scene === "halloween" ? 31 : 18), age: 0 }].slice(-12);
      petSound(petCue(scene), panAt(g.cat.x + 8, g.l.w));
    };
    const pumpkin = () => {
      if (!g) return;
      g.pumpkinLit = !g.pumpkinLit;
      g.blinkUntil = still ? 0 : g.time + 0.6;
    };
    const ghost = (x: number, y: number) => {
      if (!g) return;
      const next = summonGhost(g.ghost, g.l, x, y, g.time);
      if (next === g.ghost && !still) return;
      g.ghost = still ? (g.ghost ? null : next) : next;
      if (!still) g.cat = { ...g.cat, mode: "alert", timer: 1, goal: "wander", target: g.cat.x, dir: x > g.cat.x + 8 ? 1 : -1 };
    };

    build();
    const resize = new ResizeObserver(() => {
      build();
      render();
    });
    resize.observe(wrap);

    // Measured from the drawn box, so a preview scaled down in /admin still hits the right cell.
    const toGrid = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      if (g) g.targetSize = e.pointerType === "touch" ? 44 * canvas.width / box.width : 0;
      return { x: ((e.clientX - box.left) / box.width) * canvas.width, y: ((e.clientY - box.top) / box.height) * canvas.height };
    };
    const onMove = (e: PointerEvent) => {
      if (!g) return;
      g.pointer = toGrid(e);
      const hit = hits(g);
      canvas.style.cursor = hit.cat || hit.pumpkin || hit.house || hit.grass || hit.crackers || (scene === "halloween" && hit.sky) ? "pointer" : "default";
      if (still) render();
    };
    const onLeave = () => {
      if (!g) return;
      g.pointer = null;
      if (still) render();
    };
    const onDown = (e: PointerEvent) => {
      if (!g || (e.target as HTMLElement).closest("button")) return;
      g.pointer = toGrid(e);
      const hit = hits(g);
      const { l } = g;
      if (scene === "halloween") {
        if (hit.cat) { pet(); g.overCat = true; render(); return; }
        if (hit.pumpkin) { pumpkin(); render(); return; }
        if (hit.sky && night) { ghost(g.pointer.x, g.pointer.y); render(); return; }
        if (hit.sky && !night) {
          g.fireflies = [...g.fireflies, { ...g.pointer, phase: g.time }].slice(-MAX_FIREFLIES);
          render();
          return;
        }
      }
      if (still) return;
      if (hit.grass) {
        const to = Math.max(l.spots.minX, Math.min(l.spots.maxX + 10, g.pointer.x - 3));
        g.yarn = { x: g.yarn.x, from: g.yarn.x, to, t: 0 };
        g.pounce = to + 3;
        yarnSound(panAt(to, l.w));
      } else if (hit.sky) {
        const { x, y } = g.pointer;
        const cue = skyCue(scene, night);
        const pan = panAt(x, l.w);
        if (cue === "firework") {
          // The whistle lasts as long as the trail climbs: 60 cells a second.
          if (launch(x, y, true)) skySound(cue, pan, (l.ground - 2 - Math.round(y)) / 60);
          g.cat = { ...g.cat, mode: "alert", timer: 1, goal: "wander", target: g.cat.x, dir: x > g.cat.x + 8 ? 1 : -1 };
        } else if (cue === "paper") {
          g.bits.push({ x: Math.round(x), y: Math.round(y), rest: l.ground + Math.floor(Math.random() * 3), key: "red" });
          skySound(cue, pan);
        } else if (cue === "drop") {
          g.bits.push({ x: Math.round(x), y: Math.round(y), rest: l.ground - 2, key: "drop" });
        } else if (cue === "firefly") {
          g.fireflies = [...g.fireflies, { x, y, phase: g.time }].slice(-MAX_FIREFLIES);
          skySound(cue, pan);
        }
      }
    };
    const onAction = (e: Event) => {
      if (!g) return;
      const action = (e.currentTarget as HTMLElement).dataset.gardenAction;
      if (action === "pet") pet();
      if (action === "pumpkin") pumpkin();
      if (action === "ghost") {
        if (night) ghost(Math.round(g.l.w * 0.58), 28);
        else g.fireflies = [...g.fireflies, { x: Math.round(g.l.w * 0.58), y: 28, phase: g.time }].slice(-MAX_FIREFLIES);
      }
      render();
    };
    const controls = wrap.querySelectorAll<HTMLButtonElement>("[data-garden-action]");
    controls.forEach((button) => button.addEventListener("click", onAction));
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("pointerdown", onDown);
    const cleanup = () => {
      resize.disconnect();
      controls.forEach((button) => button.removeEventListener("click", onAction));
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("pointerdown", onDown);
    };

    if (still) {
      render();
      canvas.dataset.state = "still";
      return cleanup;
    }

    // Only spend frames while the banner is on screen.
    let frame = 0;
    let prev = 0;
    const loop = (now: number) => {
      tick(prev ? Math.min(now - prev, 100) / 1000 : 0);
      prev = now;
      render();
      frame = requestAnimationFrame(loop);
    };
    let visible = false;
    const resume = () => {
      if (visible && !document.hidden && !frame) frame = requestAnimationFrame(loop);
      if (!visible || document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        prev = 0;
      }
    };
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      resume();
    });
    document.addEventListener("visibilitychange", resume);
    seen.observe(canvas);
    canvas.dataset.state = "running";
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
      document.removeEventListener("visibilitychange", resume);
      cleanup();
    };
  }, [theme, still, scene, windy]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        aria-hidden
        data-scene="garden"
        data-weather={scene}
        className="absolute top-0 left-0 [image-rendering:pixelated]"
      />
      {scene === "halloween" && (
        <div className="absolute top-2 left-2 flex gap-2">
          {([ ["pet", "Pet Meiqiu"], ["pumpkin", "Toggle pumpkin lights"], ["ghost", "Summon a ghost"] ] as const).map(([action, label]) => (
            <button key={action} type="button" data-garden-action={action}
              className="sr-only focus:not-sr-only focus:relative focus:min-h-11 focus:bg-bg focus:px-3 focus:text-xs focus:text-body focus:outline-2 focus:outline-accent"
              aria-pressed={action === "pumpkin" ? nightOf(theme) : undefined}>{action === "ghost" && theme === "light" ? "Add a firefly" : label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
