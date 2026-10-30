import type { Pose } from "./sprites";

// 煤球's day as a small state machine. `step` is pure: the banner calls it every frame with
// what the cursor is doing, and draws whatever comes back. Distances are grid cells; `x` is
// the left edge of the 16-cell sprite.

export type Mode = "walk" | "sit" | "happy" | "sleep" | "alert" | "chase";
export type Goal = "wander" | "butterfly" | "flower" | "bowl" | "cushion" | "yarn";

export interface Spots {
  minX: number;
  maxX: number;
  cushion: number;
  bowl: number;
  flowers: number[];
  butterfly: number;
}

export interface World {
  hoverCat: boolean;
  hoverHouse: boolean;
  /** Set for one step when the reader throws the yarn: where it will stop. */
  pounce: number | null;
  spots: Spots;
}

export interface Cat {
  x: number;
  dir: 1 | -1;
  mode: Mode;
  goal: Goal;
  target: number;
  timer: number;
  clock: number;
}

/** Cells per second: one cell per walk frame at 8 fps. */
export const WALK_SPEED = 8;
export const CHASE_SPEED = 24;
const PURR_HOLD = 0.6;
const WAKE_AFTER = 3;
const ALERT_FOR = 0.5;

export function newCat(x: number): Cat {
  return { x, dir: -1, mode: "sit", goal: "wander", target: x, timer: 2, clock: 0 };
}

const clamp = (x: number, s: Spots) => Math.min(s.maxX, Math.max(s.minX, x));

function nextGoal(c: Cat, s: Spots, rng: () => number): Cat {
  const roll = rng();
  let goal: Goal = "wander";
  let target = s.minX + rng() * (s.maxX - s.minX);
  if (roll < 0.3) {
    goal = "butterfly";
    target = s.butterfly - 8;
  } else if (roll < 0.6 && s.flowers.length) {
    goal = "flower";
    target = s.flowers[Math.floor(rng() * s.flowers.length) % s.flowers.length];
  } else if (roll < 0.75) {
    goal = "bowl";
    target = s.bowl - 4;
  }
  return { ...c, mode: "walk", goal, target: clamp(target, s) };
}

function move(c: Cat, speed: number, dt: number, s: Spots): { cat: Cat; arrived: boolean } {
  const d = c.target - c.x;
  if (Math.abs(d) < 1) return { cat: { ...c, x: clamp(c.target, s) }, arrived: true };
  const dir = d > 0 ? 1 : -1;
  const x = clamp(c.x + dir * Math.min(Math.abs(d), speed * dt), s);
  return { cat: { ...c, x, dir }, arrived: x === c.x };
}

export function step(cat: Cat, dt: number, w: World, rng: () => number): Cat {
  const s = w.spots;
  let c: Cat = { ...cat, clock: cat.clock + dt };

  if (w.pounce !== null) {
    const target = clamp(w.pounce - 8, s);
    return { ...c, mode: "alert", goal: "yarn", target, timer: ALERT_FOR, dir: target > c.x ? 1 : -1 };
  }
  if (w.hoverHouse) {
    if (c.mode === "sleep") return { ...c, timer: WAKE_AFTER };
    if (c.goal !== "cushion" || c.mode !== "walk") c = { ...c, mode: "walk", goal: "cushion", target: clamp(s.cushion, s) };
  } else if (w.hoverCat && c.mode !== "sleep") {
    return { ...c, mode: "happy", timer: PURR_HOLD };
  }

  switch (c.mode) {
    case "happy":
    case "sleep": {
      const timer = c.timer - dt;
      return timer > 0 ? { ...c, timer } : { ...c, mode: "sit", goal: "wander", timer: 1.5 };
    }
    case "alert": {
      const timer = c.timer - dt;
      return timer > 0 ? { ...c, timer } : { ...c, mode: "chase", timer: 0 };
    }
    case "chase": {
      const { cat: next, arrived } = move(c, CHASE_SPEED, dt, s);
      return arrived ? { ...next, mode: "sit", timer: 2 } : next;
    }
    case "walk": {
      const { cat: next, arrived } = move(c, WALK_SPEED, dt, s);
      if (!arrived) return next;
      if (next.goal === "cushion") return { ...next, mode: "sleep", timer: WAKE_AFTER };
      return { ...next, mode: "sit", timer: 2 + rng() * 2 };
    }
    case "sit": {
      const timer = c.timer - dt;
      return timer > 0 ? { ...c, timer } : nextGoal({ ...c, timer: 0 }, s, rng);
    }
  }
}

/** Which sprite to draw. `now` (seconds) times the blink while sitting. */
export function poseOf(c: Cat, now: number): Pose {
  switch (c.mode) {
    case "walk":
      return Math.floor(c.clock * 8) % 2 === 0 ? "walk1" : "walk2";
    case "chase":
      return Math.floor(c.clock * 16) % 2 === 0 ? "walk1" : "walk2";
    case "sit":
      return now % 3.2 > 3.05 ? "blink" : "idle";
    default:
      return c.mode;
  }
}
