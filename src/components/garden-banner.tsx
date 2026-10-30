import { useEffect, useRef } from "react";
import { burstSound, dropSound, lampSound, petSound, popSound, skySound, yarnSound } from "@/components/garden-sound";
import { type Cat, newCat, poseOf, step } from "@/lib/garden/meiqiu";
import { tonightsPhase } from "@/lib/garden/moon";
import { type Key, PALETTES } from "@/lib/garden/palette";
import { type Layout, CELL, gridSize, layout, paintStatic, PEAK, windows } from "@/lib/garden/scene";
import { panAt, petCue, skyCue } from "@/lib/garden/sounds";
import { BUTTERFLY, FEET, HEART, POSES, type Pixel, type Pose, ZED_BIG, ZED_SMALL } from "@/lib/garden/sprites";
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

/** Everything the loop mutates. Kept out of React state: it changes 60 times a second. */
interface Garden {
  l: Layout;
  scene: SceneName;
  bg: HTMLCanvasElement;
  flashBg: HTMLCanvasElement | null;
  cat: Cat;
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
}

const nightOf = (theme: Theme) => theme === "dark";

function hits(g: Garden) {
  const p = g.pointer;
  const { l, cat } = g;
  if (!p) return { cat: false, house: false, grass: false, sky: false, crackers: false };
  const hidden = g.scene === "storm"; // 煤球 is indoors
  const onCat = !hidden && p.x >= cat.x && p.x <= cat.x + 16 && p.y >= l.ground - 14 && p.y <= l.ground;
  const onHouse = p.x >= l.house.x && p.x <= l.house.x + l.house.w && p.y >= l.house.top && p.y <= l.ground;
  const box = g.scene === "spring" && g.popped < CRACKERS ? crackerBox(l) : null;
  const onCrackers = !!box && p.x >= box.x && p.x < box.x + box.w && p.y >= box.y && p.y < box.y + box.h;
  return {
    cat: onCat,
    house: onHouse && !onCat,
    grass: !onCat && !onHouse && p.y >= l.ground - 8,
    sky: p.y < l.ground - 18,
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

  if (night && (scene === "clear" || scene === "cloudy")) {
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
  if (scene !== "storm") {
    if (cat.mode === "sleep") {
      const cx = Math.round(cat.x);
      ctx.fillStyle = palette.pink;
      ctx.fillRect(cx, G - 2, 17, 1);
      ctx.fillRect(cx - 1, G - 1, 19, 1);
      ctx.fillStyle = palette.cushion;
      ctx.fillRect(cx, G - 1, 17, 1);
    }
    sprite(POSES[pose], Math.round(cat.x), oy, cat.dir === 1);
    if (scene === "spring") {
      // A red scarf with a gold bell.
      const r = SCARF_ROW[pose];
      const scarf: Pixel[] = [];
      for (let x = 1; x <= 12; x++) scarf.push([x, r, "red"]);
      scarf.push([6, r + 1, "gold"], [11, r + 1, "red"]);
      sprite(scarf, Math.round(cat.x), oy, cat.dir === 1);
    }
    if (cat.mode === "sleep") {
      const rise = (time * 2) % 6;
      sprite(ZED_BIG, cat.x + 13, oy - 2 - Math.floor(rise / 2), false, 3);
      if (rise > 2) sprite(ZED_SMALL, cat.x + 17, oy - 6 - Math.floor(rise / 3), false, 2);
    }
  }
  for (const h of g.hearts) {
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

/** 煤球's garden: a pixel scene in the site's blues that 煤球 wanders around, in one of seven themes. */
export function GardenBanner({ theme, still, scene = "clear" }: { theme: Theme; still: boolean; scene?: SceneName }) {
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

    const build = () => {
      const { w, h } = gridSize(wrap.clientWidth, wrap.clientHeight);
      if (!w || !h) return;
      const l = layout(w, h);
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
        yarn: g?.yarn ?? { x: l.bowl - 34, from: l.bowl - 34, to: l.bowl - 34, t: 1 },
        fireflies:
          g?.fireflies ??
          [0.27, 0.68, 0.16, 0.45, 0.94].map((fx, i) => ({ x: Math.round(w * fx), y: l.ground - [23, 25, 29, 41, 43][i], phase: i * 1.7 })),
        hearts: [],
        sway: new Map(),
        pointer: null,
        overCat: false,
        overHouse: false,
        pounce: null,
        pets: g?.pets ?? 0,
        time: g?.time ?? 0,
        // The paw prints and the red paper stay until reload, but only in their own scene.
        prints: g?.l.w === w ? g.prints : [],
        lastPrint: g?.lastPrint ?? -1,
        fireworks: [],
        trails: [],
        nextLaunch: (g?.time ?? 0) + 1.5,
        popped: g?.popped ?? 0,
        nextPop: null,
        puffs: [],
        bits: g?.l.w === w ? g.bits.filter((b) => b.key !== "drop") : [],
        fade: fade ?? g?.fade ?? null,
      };
      g.cat = { ...g.cat, x: Math.min(g.cat.x, l.spots.maxX) };
      gardenRef.current = g;
      g.yarn.x = Math.min(g.yarn.x, l.spots.maxX);
    };

    const render = () => {
      if (!g) return;
      const hit = hits(g);
      let cat = g.cat;
      if (still) cat = { ...cat, mode: hit.cat ? "happy" : "sleep" };
      let pose = poseOf(cat, g.time);
      if (scene === "snow" && (pose === "idle" || pose === "blink")) pose = "happy"; // 煤球 loves snow
      draw(ctx, { ...g, cat }, theme, pose, hit.house, still);
      if (g.fade) {
        const stepNo = Math.floor(g.fade.age / FADE_STEP) + 1;
        if (stepNo >= FADE_STEPS) g.fade = null;
        else dither(ctx, g.fade.from, stepNo);
      }
      canvas.dataset.catX = String(Math.round((g.cat.x + 8) * CELL));
      canvas.dataset.catY = String(Math.round((g.l.ground - 6) * CELL));
      canvas.dataset.catMode = scene === "storm" ? "hidden" : cat.mode;
    };

    /** False when two bursts are already up. */
    const launch = (x: number, toY: number, heard = false) => {
      if (!g || g.fireworks.length + g.trails.length >= MAX_BURSTS) return false;
      const colors: Firework["color"][] = ["red", "gold", "g4"];
      g.trails.push({ x: Math.round(x), y: g.l.ground - 2, toY: Math.round(toY), color: colors[Math.floor(Math.random() * 3)], heard });
      return true;
    };

    const tick = (dt: number) => {
      if (!g) return;
      g.time += dt;
      if (g.fade) g.fade.age += dt;
      const hit = hits(g);
      const { l } = g;
      const w = l.w;
      const pan = (x: number) => panAt(x, w);
      if (hit.cat && !g.overCat) {
        g.pets += 1;
        g.hearts.push({ x: g.cat.x + 6, y: l.ground - 18, age: 0 });
        petSound(petCue(scene), pan(g.cat.x + 8));
      }
      g.overCat = hit.cat;
      // The lamps click on, unless rain has lit them already.
      if (hit.house && !g.overHouse && scene !== "rain" && scene !== "storm") lampSound(pan(l.house.x + l.house.w / 2));
      g.overHouse = hit.house;
      l.spots.butterfly = Math.round(w / 2 + Math.sin(g.time * 0.4) * w * 0.3);

      // Rain: 煤球 walks to the tree and waits there.
      const rainy = scene === "rain" || scene === "storm";
      const home = sceneSpots(l, scene);
      let spots = l.spots;
      if (rainy) {
        const near = Math.abs(g.cat.x - home.minX) < 1;
        if (near && g.cat.goal !== "yarn") spots = { ...home, butterfly: l.spots.butterfly };
        else if (!near && g.cat.goal !== "yarn" && (g.cat.mode === "sit" || g.cat.mode === "sleep" || g.cat.target !== home.minX)) {
          if (g.cat.mode !== "happy" && g.cat.mode !== "alert" && g.cat.mode !== "chase") {
            g.cat = { ...g.cat, mode: "walk", goal: "wander", target: home.minX };
          }
        }
      }
      g.cat = step(
        g.cat,
        dt,
        { hoverCat: hit.cat, hoverHouse: hit.house && !rainy, pounce: g.pounce, spots },
        Math.random,
      );
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
      g.hearts = g.hearts.map((h) => ({ ...h, age: h.age + dt })).filter((h) => h.age < 1.2);
      for (const f of l.flowers) {
        const near = Math.abs(g.cat.x + 8 - f.x) < 4 && g.cat.mode !== "sit";
        const left = Math.max(0, (g.sway.get(f.x) ?? 0) - dt);
        g.sway.set(f.x, near ? 0.4 : left);
      }
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
      return { x: ((e.clientX - box.left) / box.width) * canvas.width, y: ((e.clientY - box.top) / box.height) * canvas.height };
    };
    const onMove = (e: PointerEvent) => {
      if (!g) return;
      g.pointer = toGrid(e);
      const hit = hits(g);
      canvas.style.cursor = hit.cat || hit.house || hit.grass || hit.crackers ? "pointer" : "default";
      if (still) render();
    };
    const onLeave = () => {
      if (!g) return;
      g.pointer = null;
      if (still) render();
    };
    const onDown = (e: PointerEvent) => {
      if (!g || still) return;
      g.pointer = toGrid(e);
      const hit = hits(g);
      const { l } = g;
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
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("pointerdown", onDown);
    const cleanup = () => {
      resize.disconnect();
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
    const seen = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !frame) frame = requestAnimationFrame(loop);
      if (!entry.isIntersecting) {
        cancelAnimationFrame(frame);
        frame = 0;
        prev = 0;
      }
    });
    seen.observe(canvas);
    canvas.dataset.state = "running";
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
      cleanup();
    };
  }, [theme, still, scene]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        aria-hidden
        data-scene="garden"
        data-weather={scene}
        className="absolute top-0 left-0 [image-rendering:pixelated]"
      />
    </div>
  );
}
