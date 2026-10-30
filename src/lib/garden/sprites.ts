import type { Key } from "./palette";

// 煤球's poses from the Paper pose sheet ("煤球 · SVG 动作表"): a 16x16 grid, written as
// "y,x,width" runs per colour. The cat faces left; mirror it to walk right.

export type Pose = "idle" | "blink" | "walk1" | "walk2" | "happy" | "alert" | "sleep";
export type Pixel = readonly [x: number, y: number, key: Key];

const BODY = [4, 5, 6, 7, 8, 9, 10, 11].map((y) => `${y},1,12`).join("|");
const EARS = "2,1,1|2,12,1|3,1,3|3,10,3";
const TAIL = "7,14,1|8,14,1|9,14,1|10,13,2";
const EYES = "6,3,1|6,10,1|7,3,1|7,10,1";
const CHEEKS = "8,2,2|8,10,2";

const SOURCE: Record<Pose, Partial<Record<Key, string>>> = {
  idle: { cat: `${BODY}|${EARS}|${TAIL}|12,2,2|12,10,2`, eye: EYES, pink: CHEEKS },
  blink: { cat: `${BODY}|${EARS}|${TAIL}|12,2,2|12,10,2`, eye: "7,3,1|7,10,1", pink: CHEEKS },
  walk1: { cat: `${BODY}|${EARS}|${TAIL}|12,1,2|12,9,2`, eye: EYES, pink: CHEEKS },
  walk2: { cat: `${BODY}|${EARS}|${TAIL}|12,3,2|12,11,2`, eye: EYES, pink: CHEEKS },
  happy: {
    cat: `${BODY}|${EARS}|6,14,1|${TAIL}|12,2,2|12,10,2`,
    eye: "5,3,1|5,10,1|6,2,1|6,4,1|6,9,1|6,11,1",
    pink: CHEEKS,
  },
  alert: {
    cat:
      [5, 6, 7, 8, 9, 10, 11, 12].map((y) => `${y},1,12`).join("|") +
      "|1,1,1|1,12,1|2,1,1|2,12,1|3,1,1|3,12,1|4,1,3|4,10,3|" +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => `${y},15,1`).join("|") +
      "|10,13,3|13,2,2|13,10,2",
    eye: "6,3,1|6,10,1|7,3,1|7,10,1|8,3,1|8,10,1",
    pink: "9,2,2|9,10,2",
  },
  sleep: {
    cat: [5, 6, 7, 8, 9, 10, 11, 12].map((y) => `${y},1,12`).join("|") + "|4,1,3|4,10,3|12,13,3",
    eye: "8,2,2|8,10,2",
    pink: "9,2,2|9,10,2",
  },
};

function expand(source: Partial<Record<Key, string>>): Pixel[] {
  const out: Pixel[] = [];
  for (const [key, runs] of Object.entries(source) as [Key, string][]) {
    for (const run of runs.split("|")) {
      const [y, x, w] = run.split(",").map(Number);
      for (let i = 0; i < w; i++) out.push([x + i, y, key]);
    }
  }
  return out;
}

export const POSES = Object.fromEntries(
  Object.entries(SOURCE).map(([pose, source]) => [pose, expand(source)]),
) as Record<Pose, Pixel[]>;

/** Row of the sprite that touches the ground: 13 for most poses (feet on row 12). */
export const FEET: Record<Pose, number> = {
  idle: 13, blink: 13, walk1: 13, walk2: 13, happy: 13, alert: 14, sleep: 13,
};

const tiny = (rows: string[], key: Key): Pixel[] =>
  rows.flatMap((row, y) => [...row].flatMap((c, x) => (c === "#" ? [[x, y, key] as Pixel] : [])));

export const HEART = tiny(["##.##", "#####", ".###.", "..#.."], "heart");
export const ZED_BIG = tiny(["###", "..#", ".#.", "###"], "zz");
export const ZED_SMALL = tiny(["##", ".#", "##"], "zz");
export const BUTTERFLY = [
  tiny(["##.##", ".#.#.", ".#.#."], "lamp").concat([[2, 1, "ink"], [2, 2, "ink"], [0, 0, "lamp2"], [4, 0, "lamp2"]]),
  tiny(["", ".#.#.", ".#.#."], "lamp").concat([[2, 1, "ink"], [2, 2, "ink"], [1, 0, "lamp2"], [3, 0, "lamp2"]]),
];
