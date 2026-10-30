// Ignite: a crate press. A dial picks one of the six stack plans, one key starts it, and a crate rises out of the
// well with that plan's cartridges in its sockets: plugins in the long row, a skill and a hook beside them.
import { D, HEIGHT, k, L, S, WIDTH, bench, screws } from "./common.mjs";

// The six stack plans in Ignite's catalog (Launcher/catalog/stacks.json) and how many of each they install.
const STACKS = [
  { id: "fullstack", plugins: 6, skills: 1, hooks: 1 },
  { id: "lite", plugins: 4, skills: 1, hooks: 1 },
  { id: "company-split", plugins: 3, skills: 1, hooks: 1 },
  { id: "minimal", plugins: 3, skills: 0, hooks: 1 },
  { id: "native", plugins: 4, skills: 0, hooks: 1 },
  { id: "content", plugins: 3, skills: 1, hooks: 1 },
];

const PLATE = { x: -92, y: -60, w: 200, d: 120, r: 8 };
const BOX = { x: -40, y: -50, w: 68, d: 58 };
const WALL = 4;
const WALL_H = 16;
const FLOOR = 3;
const CRATE = { x: -34, y: -44, w: 56, d: 46, r: 1 };
const CRATE_H = 22;
const LIFT = 26;
const CART_H = 4;
const PLUG = { x: -30, y: -40, w: 6.6, d: 10, gap: 1.6 };
const SKILL = [-23, -18];
const HOOK = { x: -15, y: -22.5, w: 9, d: 9 };
const DIAL = [-62, 32];
const DIAL_BASE = { x: -78, y: 16, w: 32, d: 32, r: 3 };
const KEY = { x: -26, y: 22, w: 28, d: 28, r: 3 };
const TRAVEL = 3;
const RACK = { x: 42, y: -48, w: 18, d: 56, r: 1.2 };

const crateTop = FLOOR + CRATE_H;
// Fitted, the machine would come out larger than the other three; scale it about the frame centre to theirs.
const SCALE = 1.72;
const fit = k.fitProjection(
  [...k.boxCorners(PLATE, -15, 0), [CRATE.x, CRATE.y, crateTop + CART_H + LIFT], [CRATE.x + CRATE.w, CRATE.y + CRATE.d, crateTop + CART_H + LIFT]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 56 },
);
const centre = [WIDTH / 2, HEIGHT / 2];
const P = { ...fit, scale: SCALE, origin: fit.origin.map((o, i) => centre[i] + (o - centre[i]) * (SCALE / fit.scale)) };
const at = (p) => k.iso(p, P);

const wall = (plan) => S(k.slabOf({ ...plan, r: 0.8 }, 0, WALL_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam({ ...plan, r: 0.8 }, FLOOR + 3, P, 3), { tone: "faint" }) });

function well() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan({ ...BOX, r: 2 }, 2), 0, 0.1, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.slabOf({ x: BOX.x + WALL, y: BOX.y + WALL, w: BOX.w - WALL * 2, d: BOX.d - WALL * 2, r: 0 }, 0, FLOOR, P, 2), { tone: "lo" }));
  out.push(wall({ x: BOX.x, y: BOX.y, w: BOX.w, d: WALL }));
  out.push(wall({ x: BOX.x, y: BOX.y + WALL, w: WALL, d: BOX.d - WALL * 2 }));
  // The lift mast on the back wall: two guide rails the crate rides up, joined by a head beam.
  const rails = [CRATE.x + 8, CRATE.x + CRATE.w - 12];
  const top = crateTop + LIFT - 6;
  for (const x of rails) {
    out.push(S(k.slabOf({ x, y: BOX.y + WALL, w: 4, d: 2, r: 0.3 }, FLOOR, top - FLOOR, P, 2), { tone: "mid", inner: L(k.sideSeam({ x, y: BOX.y + WALL, w: 4, d: 2, r: 0.3 }, WALL_H, P, 2), { tone: "faint" }) }));
  }
  const head = { x: rails[0] - 2, y: BOX.y + WALL - 1, w: rails[1] - rails[0] + 8, d: 4, r: 0.6 };
  out.push(S(k.slabOf(head, top, 3, P, 2, 0.3), { tone: "mid" }));
  out.push(D(rails.map((x) => at([x + 2, head.y + 2, top + 3])), { size: 0.38 }));
  return out.join("");
}

const plugAt = (i) => ({ x: PLUG.x + i * (PLUG.w + PLUG.gap), y: PLUG.y, w: PLUG.w, d: PLUG.d, r: 0.6 });

/** The crate: the new project. Its sockets are empty outlines until a plan's cartridges fill them. */
function crate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CRATE, 2), FLOOR, 0.1, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.slabOf(CRATE, FLOOR, CRATE_H, P, 3, 0.8), { tone: "hi", crease: "lo", inner: L(k.sideSeam(CRATE, crateTop - 4, P, 3), { tone: "faint" }) }));
  // The front face: a folder mark and two rule lines, the label of a project folder.
  const face = k.sideMatrix([CRATE.x, CRATE.y + CRATE.d], crateTop, P, "left");
  out.push(
    `<g transform="${face}"><path class="iso-line" data-tone="lo" d="M6 8H12L14 10H22V20H6Z"/>` +
      `<path class="iso-line" data-tone="faint" data-free="end" d="M28 11H46M28 16H40"/></g>`,
  );
  // Grip slots on the right face.
  const side = k.sideMatrix([CRATE.x + CRATE.w, CRATE.y + CRATE.d], crateTop, P, "right");
  out.push(`<g transform="${side}"><path class="iso-line" data-tone="lo" d="M14 7H32V11H14Z"/></g>`);
  const sockets = Array.from({ length: 6 }, (_, i) => k.planOutline(plugAt(i), crateTop, P, 2));
  sockets.push(k.ring(SKILL[0], SKILL[1], 4.6, crateTop, P, 24), k.planOutline({ ...HOOK, r: 0.6 }, crateTop, P, 2));
  out.push(L(sockets.join(""), { tone: "faint" }));
  out.push(screws(P, k.corners(CRATE, 3), crateTop, { r: 0.9, size: 0.36 }));
  // The vent grille on the free corner of the lid.
  out.push(D(k.dotGrid(4, -20, 4, 3, 3.4, crateTop, P), { size: 0.4, tone: "lo" }));
  return out.join("");
}

function cartridges() {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const plan = plugAt(i);
    out.push(
      `<g data-part="cart" data-kind="plugins" data-index="${i}">`,
      S(k.slabOf(k.insetPlan(plan, 0.6), crateTop, CART_H, P, 2, 0.3), { tone: "hi", crease: "lo" }),
      L(k.lineOnTop([plan.x + 1.6, plan.y + 3], [plan.x + plan.w - 1.6, plan.y + 3], crateTop + CART_H, P), { tone: "lo" }),
      "</g>",
    );
  }
  out.push(
    `<g data-part="cart" data-kind="skills" data-index="0">`,
    S(k.cylinder(SKILL[0], SKILL[1], 4, crateTop, CART_H, P, 24, 0.3), { tone: "hi", crease: "lo" }),
    L(k.ring(SKILL[0], SKILL[1], 1.6, crateTop + CART_H, P, 14), { tone: "lo" }),
    "</g>",
    `<g data-part="cart" data-kind="hooks" data-index="0">`,
    S(k.slabOf({ ...k.insetPlan(HOOK, 0.6), r: 0.6 }, crateTop, CART_H, P, 2, 0.3), { tone: "hi", crease: "lo" }),
    L(k.lineOnTop([HOOK.x + 2, HOOK.y + HOOK.d / 2], [HOOK.x + HOOK.w - 2, HOOK.y + HOOK.d / 2], crateTop + CART_H, P), { tone: "lo" }),
    "</g>",
  );
  return out.join("");
}

function nearWalls() {
  const out = [];
  const right = { x: BOX.x + BOX.w - WALL, y: BOX.y + WALL, w: WALL, d: BOX.d - WALL * 2 };
  const front = { x: BOX.x, y: BOX.y + BOX.d - WALL, w: BOX.w, d: WALL };
  out.push(wall(right), wall(front));
  for (const [x, y] of [[BOX.x, BOX.y], [BOX.x + BOX.w - 6, BOX.y], [BOX.x, BOX.y + BOX.d - 6], [BOX.x + BOX.w - 6, BOX.y + BOX.d - 6]]) {
    out.push(S(k.slabOf({ x, y, w: 6, d: 6, r: 1 }, WALL_H, 1.4, P, 3), { tone: "mid" }));
  }
  // Hazard stripes on the front wall: the lift moves here.
  const faceY = BOX.y + BOX.d;
  const stripes = k.sideMatrix([BOX.x + 10, faceY], WALL_H - 3, P, "left");
  const bars = Array.from({ length: 8 }, (_, i) => `M${i * 6} 6L${i * 6 + 4} 0`).join("");
  out.push(`<g transform="${stripes}"><path class="iso-line" data-tone="mid" d="M0 0H48V6H0Z"/><path class="iso-line" data-tone="faint" d="${bars}"/></g>`);
  out.push(D([at([BOX.x + 6, faceY, WALL_H - 6]), at([BOX.x + BOX.w - 6, faceY, WALL_H - 6])], { size: 0.45 }));
  return out.join("");
}

/** The cartridge rack: spare plugins, skills and hooks standing in their lanes. */
function rack() {
  const out = [S(k.slabOf(RACK, 0, 5, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(RACK, 2, P, 3), { tone: "faint" }) })];
  out.push(L(k.planOutline(k.insetPlan(RACK, 2), 5, P, 3), { tone: "faint" }));
  const ys = Array.from({ length: 8 }, (_, i) => RACK.y + 4 + i * 6.4);
  ys.forEach((y, i) => {
    const plan = { x: RACK.x + 4, y, w: RACK.w - 8, d: 4, r: 0.5 };
    const h = i < 6 ? 12 : 9;
    out.push(S(k.slabOf(plan, 5, h, P, 2, 0.3), { tone: "mid", crease: "lo" }));
    out.push(L(k.lineOnTop([plan.x + 2, y + 2], [plan.x + plan.w - 2, y + 2], 5 + h, P), { tone: "lo" }));
  });
  // End posts with a cross bar that keeps the cartridges upright.
  for (const y of [RACK.y - 2, RACK.y + RACK.d - 2]) out.push(S(k.slabOf({ x: RACK.x + RACK.w / 2 - 2, y, w: 4, d: 4, r: 0.6 }, 5, 16, P, 2, 0.3), { tone: "mid" }));
  out.push(screws(P, [[RACK.x + 2.4, RACK.y + 2.4], [RACK.x + RACK.w - 2.4, RACK.y + RACK.d - 2.4]], 5, { r: 0.8, size: 0.34 }));
  return out.join("");
}

const ANGLES = STACKS.map((_, i) => -Math.PI * 0.5 + i * Math.PI * 0.2);
const dialPointer = (angle) => k.lineOnTop(DIAL, [DIAL[0] + Math.sin(angle) * 6.6, DIAL[1] - Math.cos(angle) * 6.6], 11, P);
function dial() {
  const [x, y] = DIAL;
  const out = [S(k.slabOf(DIAL_BASE, 0, 4, P, 3, 0.5), { tone: "mid" })];
  out.push(screws(P, k.corners(DIAL_BASE, 2.6), 4, { r: 0.8, size: 0.34 }));
  // Six stops on the scale, one for each plan; the first is long.
  out.push(L(k.ring(x, y, 10.4, 4, P, 48), { tone: "lo" }));
  const stop = (a, inner) => k.lineOnTop([x + Math.sin(a) * inner, y - Math.cos(a) * inner], [x + Math.sin(a) * 13.4, y - Math.cos(a) * 13.4], 4, P);
  out.push(L(ANGLES.slice(1).map((a) => stop(a, 11.4)).join(""), { tone: "mid" }), L(stop(ANGLES[0], 10.4), { tone: "hi" }));
  out.push(S(k.cylinder(x, y, 8.4, 4, 2, P, 32), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 7.2, 6, 5, P, 32, 0.4), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 7.2, 6, 11, 30, P), { tone: "lo" }));
  return out.join("");
}

function keyBase() {
  const out = [];
  // A flat cable from the key to the lift, under a clamp.
  out.push(S(k.slabOf({ x: -16, y: BOX.y + BOX.d, w: 8, d: KEY.y - BOX.y - BOX.d, r: 0.3 }, 0, 0.8, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf({ x: -18, y: 12, w: 12, d: 3, r: 0.5 }, 0, 2, P, 2, 0.2), { tone: "mid" }));
  out.push(D([at([-17, 13.5, 2]), at([-7, 13.5, 2])], { size: 0.36 }));
  // The linkage from the dial to the key housing.
  out.push(S(k.slabOf({ x: DIAL_BASE.x + DIAL_BASE.w, y: 30, w: KEY.x - DIAL_BASE.x - DIAL_BASE.w, d: 4, r: 0.6 }, 1, 2.4, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf(KEY, 0, 10, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(KEY, 2.6), 10, P, 4), { tone: "faint" }));
  out.push(screws(P, k.corners(KEY, 2.2), 10, { r: 0.9, size: 0.36 }));
  return out.join("");
}

function keycap() {
  const cap = k.insetPlan(KEY, 4.2);
  const top = k.insetPlan(KEY, 6.4);
  return [
    S(k.slabOf(cap, 10, 5, P, 4, 0.5), { tone: "hi", crease: "lo" }),
    S(k.slabOf(top, 15, 1.6, P, 4, 0.5), { tone: "hi", crease: "lo" }),
    k.faceTextSvg(k.topMatrix([KEY.x + KEY.w / 2, KEY.y + KEY.d / 2 + 2.4], 16.6, P, "x"), "I", { size: 7, tone: "mid", anchor: "middle" }),
  ].join("");
}

const home = STACKS.length - 1;
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "Ignite drawn as a crate press. A dial picks one of six stack plans and one key starts it. A crate, the new project, rises out of a well with the plan's cartridges in its sockets: a row of plugins, a skill and a hook.",
  body: [
    bench(P, PLATE, { ruler: { x: 34, y: 44, w: 64, d: 6, r: 1 }, label: { x: 70, y: 18, w: 30, d: 16, r: 1.2 } }),
    well(),
    `<g data-part="crate">${crate()}${cartridges()}</g>`,
    nearWalls(),
    rack(),
    dial(),
    `<path data-part="pointer" class="iso-line" data-tone="hi" data-free="end" d="${dialPointer(ANGLES[home])}"/>`,
    D([at([DIAL[0], DIAL[1], 11])], { size: 0.5, tone: "hi" }),
    keyBase(),
    `<g data-part="keycap">${keycap()}</g>`,
  ],
});

export const figure = { name: "ignite", svg, params: { P, stacks: STACKS, lift: LIFT, travel: TRAVEL, dial: DIAL, angles: ANGLES, home } };
