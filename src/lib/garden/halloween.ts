import type { Layout } from "./scene";
import type { Pixel, Pose } from "./sprites";
import type { Key } from "./palette";

// Paper: Banner · 煤球的花园 万圣节 spec. All coordinates are grid cells.
const art = (rows: string[], colors: Record<string, Key>): Pixel[] =>
  rows.flatMap((row, y) => [...row].flatMap((c, x) => colors[c] ? [[x, y, colors[c]] as Pixel] : []));

export const PUMPKIN_ROWS = [
  "....ss......", "...ss.......", "..ooooooo...", "ooooooooooo.", "oOooOooOooO.",
  "oOOoOooOoOO.", "oOOoooOooOO.", "ooOOoooOOoo.", "oooOOOOOooo.", "..ooooooo...",
];
export const WITCH_HAT = art([
  "......dd....", ".....ddd....", ".....dddd...", "....ddddd...",
  "....dddddd..", "...ddddddd..", "...ooooooo..", ".ddddddddddd",
], { d: "costume", o: "pumpkin" });
export const HAT_TOP: Record<Pose, number> = { idle: -6, blink: -6, walk1: -6, walk2: -6, happy: -6, alert: -7, sleep: -3 };
export const CANDY = art([
  "o.......o", ".o.ooo.o.", "..ooooo..", "..oOOOo..", "..ooooo..", ".o.ooo.o.", "o.......o",
], { o: "pumpkin", O: "candle" });
const WEB = art([
  "w..........", "wwwwwwwwwww", "w.w..w...w.", "w..w.w..w..", "wwwwwwww...",
  "w..www.....", "w.w.w......", "ww..w......", "w...w......",
], { w: "web" });
const BATS = [
  ["d.........d", "dd.......dd", ".dd..d..dd.", ".ddddddddd.", "..ddddddd..", "....ddd...."],
  ["d.........d", "dd...d...dd", "ddddddddddd", ".ddddddddd.", "..ddd.ddd..", "...d...d..."],
  [".....d.....", "....ddd....", "...ddddd...", "..ddddddd..", ".ddd...ddd.", "dd.......dd"],
].map((rows) => art(rows, { d: "costume" }));
const GHOSTS = [".ww.ww.ww.", "..ww..ww.."].map((hem) => art([
  "...wwww...", "..wwwwww..", ".wwwwwwww.", ".wwkwwkww.", ".wwkwwkww.",
  ".wwwwwwww.", ".wwwkkwww.", ".wwwwwwww.", ".wwwwwwww.", hem,
], { w: "ghost", k: "costume" }));

export function pumpkinBoxes(l: Layout) {
  return [Math.max(0, l.house.x - 16), l.w - 12].map((x) => ({ x, y: l.ground - 10, w: 12, h: 10 }));
}

export function decorations(l: Layout, night: boolean, t: number, lit: boolean, still = false): Pixel[] {
  const out: Pixel[] = [];
  const put = (dots: Pixel[], ox: number, oy: number) => {
    for (const [x, y, k] of dots) out.push([x + ox, y + oy, k]);
  };
  const pumpkin = art(PUMPKIN_ROWS, { s: "pumpkinShade", o: "pumpkin", O: lit ? "candle" : "cutout" });
  for (const box of pumpkinBoxes(l)) put(pumpkin, box.x, box.y);
  put(WEB, l.house.x + 9, l.ground - 16);
  // A quiet crossing every ten seconds, with a five-second flight.
  if (night && !still && t >= 8) {
    const flight = (t - 8) % 10;
    if (flight < 5) {
      const frame = [0, 1, 2, 1][Math.floor(t * 8) % 4];
      put(BATS[frame], Math.round((flight / 5) * (l.w + 11)) - 11, 14);
      put(BATS[(frame + 1) % 3], Math.round((flight / 5) * (l.w + 11)) - 25, 21);
    }
  }
  return out;
}

export interface Ghost { x: number; y: number; born: number }
export const GHOST_FOR = 1.6;

export function summonGhost(current: Ghost | null, l: Layout, x: number, y: number, t: number): Ghost {
  if (current && t - current.born < GHOST_FOR) return current;
  return { x: Math.max(0, Math.min(l.w - 10, Math.round(x))), y: Math.max(5, Math.min(l.ground - 28, Math.round(y))), born: t };
}

export function ghostFrame(ghost: Ghost, t: number, still = false): { dots: Pixel[]; opacity: number } {
  const age = t - ghost.born;
  if (!still && (age < 0 || age >= GHOST_FOR - 1e-9)) return { dots: [], opacity: 0 };
  const rise = still ? 0 : Math.min(4, Math.floor(age / GHOST_FOR * 5));
  const dots = GHOSTS[still ? 0 : Math.floor(age * 4) % 2].map(([x, y, k]) => [ghost.x + x, ghost.y + y - rise, k] as Pixel);
  return { dots, opacity: still ? 1 : Math.max(0, Math.min(1, age / 0.2, (GHOST_FOR - age) / 0.4)) };
}
