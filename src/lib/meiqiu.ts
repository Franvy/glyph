// Meiqiu (煤球), the footer cat: pixel art and the yarn ball's physics.
// Pure data and maths: the DOM side lives in src/components/meiqiu-engine.ts.

/** Screen pixels per art pixel. */
export const PX = 3;

// One string per row, "." is empty.
// # body · e eye · p blush · h heart · f fish · k bone · a yarn · A yarn shade
const FILL: Record<string, string> = {
  "#": "var(--cat)",
  e: "var(--cat-eye)",
  p: "var(--blush)",
  h: "var(--heart)",
  f: "var(--fish)",
  k: "var(--mute)",
  a: "var(--accent)",
  A: "var(--accent-2)",
  w: "var(--mute)",
};

type Frame = string[];
const rows = (frame: Frame, swap: Record<number, string>) => frame.map((r, y) => swap[y] ?? r);

// The cat from the Paper pose sheet "煤球 · SVG 动作表": a 16-wide grid, seen from the front,
// tail on the right, so it reads as facing left. Each frame is cropped to the rows it uses
// and ends at the feet. Poses the sheet lacks are drawn in the same parts.
const EARS = [".#..........#...", ".###......###..."];
const BODY = ".############...";
const LEGS = "..##......##....";
const SIT = [
  ...EARS,
  BODY,
  BODY,
  ".##e######e##...",
  ".##e######e##.#.",
  ".#pp######pp#.#.",
  ".############.#.",
  ".##############.",
  BODY,
  LEGS,
];
const SIT_BLINK = rows(SIT, { 4: BODY });
// eyes glance left, right, up (the sheet's eyes sit at x 3 and 10)
const SIT_L = rows(SIT, { 4: ".#e######e###...", 5: ".#e######e###.#." });
const SIT_U = rows(SIT, { 3: ".##e######e##...", 5: ".############.#." });
// tail swung low (pose sheet 04)
const tailDown = (f: Frame) =>
  rows(f, { 4: f[4].slice(0, 13) + "...", 5: f[5].slice(0, 13) + "...", 6: f[6].slice(0, 13) + "...", 7: f[7].slice(0, 13) + "...", 8: ".###############", 9: ".############..#" });
const HAPPY = rows(SIT, { 3: ".##e######e##...", 4: ".#e#e####e#e#.#.", 5: ".############.#." });
const CLOSED = rows(SIT, { 4: BODY, 5: ".#ee######ee#.#." });
const YAWN = rows(CLOSED, { 6: ".#pp##pp##pp#.#.", 7: ".#####pp#####.#." });
const LICK = rows(CLOSED, { 7: ".######p#####.#." });
// head down to the bowl: everything but the legs drops one row
const EAT_DOWN = ["................", ...CLOSED.slice(0, 9), LEGS];
const SWAT = rows(SIT, { 7: "#############.#.", 8: "###############.", 10: "..........##...." });

// In profile, facing left, for moving: built like the crouch (Paper: 03 · 扑) — two rows of
// ears, five of body as wide as the front view, the tail up behind. Walk and run frames are
// a row taller than the body and legs so the body can bob.
const stamp = (h: number, layers: [Frame, number][]): Frame => {
  const grid = Array.from({ length: h }, () => [..."................"]);
  for (const [art, dy] of layers)
    art.forEach((row, y) => [...row].forEach((c, x) => c !== "." && grid[y + dy] && (grid[y + dy][x] = c)));
  return grid.map((r) => r.join(""));
};
const SIDE = [
  ".#..#.........#.",
  ".##.##........#.",
  ".############.#.",
  ".#e##########.#.",
  ".#e###########..",
  ".#pp#########...",
  ".############...",
];
// running: the tail streams out behind
const SIDE_RUN = rows(SIDE, {
  0: ".#..#...........",
  1: ".##.##..........",
  2: ".############...",
  3: ".#e#############",
  4: ".#e##########...",
});
// at full stretch the body is one cell longer
const STRETCHED = SIDE_RUN.map((r) => r.slice(0, 7) + r[6] + r.slice(7, 15));
const legs = (row: string, at: number): Frame => [...Array(at).fill("................"), row];

// walk: contact, passing (body up a cell), contact, passing
const WALK = [
  stamp(9, [[SIDE, 1], [legs(".##.......##....", 8), 0]]),
  stamp(9, [[SIDE, 0], [legs("..##.......##...", 7), 0]]),
  stamp(9, [[SIDE, 1], [legs("...##.......##..", 8), 0]]),
  stamp(9, [[SIDE, 0], [legs("..##.......##...", 7), 0]]),
];
// run (a gallop): reach, gather in the air, land on the front paws, push off the back
const RUN = [
  stamp(9, [[STRETCHED, 1], [legs("##...........##.", 8), 0]]),
  stamp(9, [[SIDE_RUN, 0], [legs("....##...##.....", 7), 0]]),
  stamp(9, [[SIDE_RUN, 1], [legs(".##.....##......", 8), 0]]),
  stamp(9, [[SIDE_RUN, 1], [legs("....##.......##.", 8), 0]]),
];
// front legs braced ahead, back legs skidding
const SKID = stamp(9, [[SIDE, 1], [legs("##.........##...", 8), 0]]);
// low to the ground, tail up and twitching
const CROUCH_A = [...SIDE, ".##.......##...."];
const CROUCH_B = rows(CROUCH_A, { 0: ".#..#..........#", 7: "..##.......##..." });
// in the air: front paws reaching ahead, back legs and tail straight behind
const POUNCE = stamp(9, [[STRETCHED, 0], [legs("##...........##.", 7), 0], [legs("#.............#.", 8), 0]]);

const ALERT = [
  ".#..........#..#",
  ".#..........#..#",
  ".#..........#..#",
  ".###......###..#",
  ".############..#",
  ".##e######e##..#",
  ".##e######e##..#",
  ".##e######e##..#",
  ".#pp######pp#..#",
  ".###############",
  BODY,
  BODY,
  LEGS,
];
// fur up, tail puffed to two pixels, eyes narrowed, mouth open
const ANGRY = rows(ALERT, {
  ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8].map((y) => [y, ALERT[y].slice(0, 14) + "##"])),
  5: ".##e######e##.##",
  6: ".###e####e###.##",
  7: ".############.##",
  8: ".#pp#pppp#pp#.##",
});
// up on the back legs, front paws above the ears
const REACH = [
  "#............#.#",
  "#............#.#",
  "##..........##.#",
  "##..........##.#",
  "##..........##.#",
  ".###......###..#",
  ...ALERT.slice(4),
];

const LOW = [
  ".#..........#.#.",
  ".###......###.#.",
  ".##e######e##.#.",
  ".##e######e##.#.",
  ".#pp######pp#.#.",
  ".##############.",
  BODY,
];
const STRETCH_A = rows(["..............#.", ...LOW, ".##........##..."], { 3: BODY.slice(0, 13) + ".#.", 4: ".#ee######ee#.#." });
const STRETCH_B = rows(STRETCH_A, { 8: "##.........##..." });
const SLEEP_A = [
  ".###......###...",
  BODY,
  BODY,
  BODY,
  ".#ee######ee#...",
  ".#pp######pp#...",
  BODY,
  BODY,
  ".###############",
];
const SLEEP_B = rows(SLEEP_A, { 8: ".##############." });
const TWITCH = ["............#...", ...SLEEP_A];
const LIE_A = [...EARS, BODY, BODY, ".##e######e##...", ".##e######e##...", ".#pp######pp#...", BODY, BODY, ".###############"];
const LIE_B = rows(LIE_A, { 8: ".############..#", 9: ".##############." });
// belly up: the sitting cat upside down, eyes shut in a smile
const BELLY_A = rows([...SIT].reverse(), { 4: ".#pp######pp#.#.", 5: ".#ee######ee#.#.", 6: BODY });
const BELLY_B = rows(BELLY_A, { 0: ".#.#.....#.#...." });

const FISH = ["..ffff..f", ".fffffff.", "fefffffff", ".fffffff.", "..ffff..f"];
const BONES = [".........", "..k.k...k", "kkkkkkkk.", "..k.k...k", "........."];
const HEART = [".h.h.", "hhhhh", ".hhh.", "..h.."];
// Four quarter turns of a rolling ball.
const BALL = [
  [".aaaaa.", "aAaaaaa", "aaAaaaa", "aaaAaaa", "aaaaAaa", "aaaaaAa", ".aaaaa."],
  [".aaaaa.", "aaaaaaa", "AAAAAAA", "aaaaaaa", "AAAAAAA", "aaaaaaa", ".aaaaa."],
  [".aaaaa.", "aaaaaAa", "aaaaAaa", "aaaAaaa", "aaAaaaa", "aAaaaaa", ".aaaaa."],
  [".aAaAa.", "aaAaAaa", "aaAaAaa", "aaAaAaa", "aaAaAaa", "aaAaAaa", ".aAaAa."],
];

export type Facing = "left" | "right" | "front";
export type Pose = { frames: Frame[]; face: Facing; dur?: number };

/** Every pose. `face` is the way the art looks; the engine mirrors it as needed. */
export const POSES = {
  walk: { frames: WALK, face: "left", dur: 0.6 },
  run: { frames: RUN, face: "left", dur: 0.36 },
  skid: { frames: [SKID], face: "left" },
  eat: { frames: [CLOSED, EAT_DOWN], face: "left", dur: 0.36 },
  crouch: { frames: [CROUCH_A, CROUCH_B], face: "left", dur: 0.16 },
  pounce: { frames: [POUNCE], face: "left" },
  swat: { frames: [SIT, SWAT], face: "left", dur: 0.16 },
  reach: { frames: [REACH], face: "left" },
  stretch: { frames: [STRETCH_A, STRETCH_B], face: "left", dur: 0.5 },
  lie: { frames: [LIE_A, LIE_B], face: "left", dur: 0.7 },
  sleep: { frames: [SLEEP_A, SLEEP_A, SLEEP_B, SLEEP_B], face: "left", dur: 2.4 },
  twitch: { frames: [TWITCH, ["................", ...SLEEP_A]], face: "left", dur: 0.3 },
  belly: { frames: [BELLY_A, BELLY_B], face: "left", dur: 0.5 },
  sit: { frames: [SIT, SIT, SIT, SIT, SIT, SIT_BLINK], face: "left", dur: 3 },
  sitL: { frames: [SIT_L, tailDown(SIT_L)], face: "left", dur: 1 },
  sitU: { frames: [SIT_U, tailDown(SIT_U)], face: "left", dur: 0.6 },
  purr: { frames: [HAPPY, tailDown(HAPPY)], face: "left", dur: 0.3 },
  yawn: { frames: [CLOSED, YAWN, YAWN, CLOSED], face: "left", dur: 1.2 },
  lick: { frames: [LICK, CLOSED], face: "left", dur: 0.3 },
  angry: { frames: [ANGRY], face: "left" },
  shock: { frames: [ALERT], face: "left" },
  fish: { frames: [FISH], face: "left" },
  bones: { frames: [BONES], face: "left" },
  heart: { frames: [HEART], face: "front" },
  ball: { frames: BALL, face: "front" },
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;

/** All frames of a sprite side by side in one SVG strip, one path per colour. */
export function spriteSvg(frames: Frame[]) {
  const h = frames[0].length;
  const w = frames[0][0].length;
  const n = frames.length;
  const paths: Record<string, string[]> = {};
  frames.forEach((frame, i) =>
    frame.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c !== ".") (paths[c] ??= []).push(`M${x + i * w} ${y}h1v1h-1z`);
      }),
    ),
  );
  const body = Object.entries(paths)
    .map(([c, d]) => `<path style="fill:${FILL[c]}" d="${d.join("")}"/>`)
    .join("");
  const html = `<svg viewBox="0 0 ${w * n} ${h}" width="${w * n * PX}" height="${h * PX}" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
  return { w, h, n, html };
}

// ---------- the yarn ball ----------

/** Radius in screen pixels. `y` is the bottom of the ball, above the ground. */
export const BALL_R = 10.5;
export type Ball = { x: number; y: number; vx: number; vy: number; angle: number };

const GRAVITY = 1600;
const WALL_BOUNCE = 0.6;
const GROUND_BOUNCE = 0.5;
const ROLL_FRICTION = 1.6;
const HARD_WALL = 650;

/** One physics step in a box `w` wide and `h` tall. Reports how hard it hit a wall or the ground. */
export function stepBall(b: Ball, dt: number, w: number, h: number): { wall?: number; ground?: number } {
  const hit: { wall?: number; ground?: number } = {};
  b.vy -= GRAVITY * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (b.x < BALL_R || b.x > w - BALL_R) {
    if (Math.abs(b.vx) > HARD_WALL) hit.wall = Math.abs(b.vx);
    b.x = b.x < BALL_R ? BALL_R : w - BALL_R;
    b.vx = -b.vx * WALL_BOUNCE;
  }
  if (b.y > h - 2 * BALL_R) {
    b.y = h - 2 * BALL_R;
    b.vy = -Math.abs(b.vy) * 0.4;
  }
  if (b.y <= 0) {
    b.y = 0;
    if (b.vy < -140) {
      hit.ground = -b.vy;
      b.vy = -b.vy * GROUND_BOUNCE;
    } else b.vy = 0;
    b.vx *= 1 - Math.min(1, ROLL_FRICTION * dt);
  }
  b.angle += (b.vx * dt) / BALL_R;
  if (ballResting(b)) b.vx = 0;
  return hit;
}

/** On the ground and all but still. */
export function ballResting(b: Ball) {
  return b.y === 0 && b.vy === 0 && Math.abs(b.vx) < 12;
}
