// Gtab: a card index box. Each card is a saved workspace with its pane layout on the face. A slider picks a card,
// one key lifts it out of the box: one key opens one workspace.
import { D, HEIGHT, k, L, S, WIDTH, bench, screws } from "./common.mjs";

// The workspaces on the Gtab cover: name and tab count.
const WORKSPACES = [
  { name: "limns", tabs: 3 },
  { name: "gtab", tabs: 2 },
  { name: "blog", tabs: 1 },
  { name: "infra", tabs: 4 },
];

const PLATE = { x: -88, y: -58, w: 198, d: 116, r: 8 };
const BOX = { x: -68, y: -38, w: 106, d: 72 };
const WALL = 4;
const WALL_H = 30;
const FLOOR = 4;
const CARD = { x: -62, w: 94, h: 40, t: 2 };
const CARD_Y = [-27, -13, 1, 15];
const TAB = { w: 18, h: 6 };
const LIFT = 24;
const RAIL = { x: 46, y: -34, w: 8, d: 64 };
const SLIDER = { x: 43, y: -5, w: 14, d: 10, r: 1.5 };
const KEY = { x: 66, y: 14, w: 30, d: 30, r: 3 };
const TRAVEL = 3;

const cardTop = FLOOR + CARD.h;
const P = k.fitProjection(
  [...k.boxCorners(PLATE, -15, 0), [CARD.x, CARD_Y[0], cardTop + TAB.h + LIFT], [CARD.x + CARD.w, CARD_Y[3], cardTop + TAB.h + LIFT]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 56 },
);
const at = (p) => k.iso(p, P);

function box() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan({ ...BOX, r: 2 }, 2), 0, 0.1, P)}" style="filter:blur(3px)"/>`];
  const wall = (plan) => S(k.slabOf({ ...plan, r: 0.8 }, 0, WALL_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam({ ...plan, r: 0.8 }, FLOOR, P, 3), { tone: "faint" }) });
  out.push(S(k.slabOf({ x: BOX.x + WALL, y: BOX.y + WALL, w: BOX.w - WALL * 2, d: BOX.d - WALL * 2, r: 0 }, 0, FLOOR, P, 2), { tone: "lo" }));
  out.push(wall({ x: BOX.x, y: BOX.y, w: BOX.w, d: WALL }));
  out.push(wall({ x: BOX.x, y: BOX.y + WALL, w: WALL, d: BOX.d - WALL * 2 }));
  // The follower: a block behind the cards that keeps them upright.
  const follower = { x: -46, y: CARD_Y[0] - 5, w: 66, d: 4, r: 0.6 };
  out.push(S(k.slabOf(follower, FLOOR, 22, P, 3, 0.4), { tone: "mid" }));
  return out.join("");
}

/** The pane layout of a workspace, drawn on the card's face in its own plane: x right, y down from the card top. */
function panes(tabs) {
  const [x0, y0, x1, y1] = [5, 5, CARD.w - 5, CARD.h - 6];
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const lines = [`M${x0} ${y0}H${x1}V${y1}H${x0}Z`];
  if (tabs === 2) lines.push(`M${mx} ${y0}V${y1}`);
  if (tabs === 3) lines.push(`M${x0 + (x1 - x0) * 0.54} ${y0}V${y1}`, `M${x0 + (x1 - x0) * 0.54} ${my}H${x1}`);
  if (tabs === 4) lines.push(`M${mx} ${y0}V${y1}`, `M${x0} ${my}H${x1}`);
  // The prompt line in the first pane: a cursor block where the shell waits.
  const cursor = `<rect x="${x0 + 3}" y="${y1 - 5}" width="2.2" height="3" class="iso-cursor"/>`;
  return `<path class="iso-line" data-tone="lo" d="${lines.join("")}"/>${cursor}`;
}

function card(index) {
  const y = CARD_Y[index];
  const plan = { x: CARD.x, y, w: CARD.w, d: CARD.t, r: 0.4 };
  const tab = { x: CARD.x + 6 + index * 22, y, w: TAB.w, d: CARD.t, r: 0.4 };
  const face = k.sideMatrix([CARD.x, y + CARD.t], cardTop, P, "left");
  return [
    `<g data-part="card" data-index="${index}">`,
    S(k.slabOf(tab, cardTop, TAB.h, P, 2), { tone: "hi", crease: "lo" }),
    S(k.slabOf(plan, FLOOR, CARD.h, P, 2), { tone: "hi", crease: "lo" }),
    `<g transform="${face}">${panes(WORKSPACES[index].tabs)}</g>`,
    "</g>",
  ].join("");
}

function nearWalls() {
  const out = [];
  const right = { x: BOX.x + BOX.w - WALL, y: BOX.y + WALL, w: WALL, d: BOX.d - WALL * 2, r: 0.8 };
  const front = { x: BOX.x, y: BOX.y + BOX.d - WALL, w: BOX.w, d: WALL, r: 0.8 };
  out.push(S(k.slabOf(right, 0, WALL_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(right, FLOOR, P, 3), { tone: "faint" }) }));
  out.push(S(k.slabOf(front, 0, WALL_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(front, FLOOR, P, 3), { tone: "faint" }) }));
  // Brass corner caps over the four wall joints.
  for (const [x, y] of [[BOX.x, BOX.y], [BOX.x + BOX.w - 6, BOX.y], [BOX.x, BOX.y + BOX.d - 6], [BOX.x + BOX.w - 6, BOX.y + BOX.d - 6]]) {
    out.push(S(k.slabOf({ x, y, w: 6, d: 6, r: 1 }, WALL_H, 1.4, P, 3), { tone: "mid" }));
  }
  // A label holder on the front wall: a frame with a card in it and two rivets.
  const faceY = BOX.y + BOX.d;
  const holder = k.sideMatrix([-30, faceY], WALL_H - 6, P, "left");
  out.push(`<g transform="${holder}"><path class="iso-line" data-tone="mid" d="M0 0H36V14H0Z"/><path class="iso-line" data-tone="faint" d="M3 3H33V11H3Z"/></g>`);
  out.push(D([at([-33, faceY, WALL_H - 13]), at([9, faceY, WALL_H - 13])], { size: 0.45 }));
  return out.join("");
}

function selector() {
  const out = [];
  out.push(S(k.slabOf({ ...RAIL, r: 1 }, 0, 3, P, 3, 0.4), { tone: "mid" }));
  // A detent groove across the rail for every card, edge to edge.
  out.push(L(CARD_Y.map((y) => k.lineOnTop([RAIL.x, y + CARD.t / 2], [RAIL.x + RAIL.w, y + CARD.t / 2], 3, P)).join(""), { tone: "lo" }));
  for (const y of [RAIL.y - 4, RAIL.y + RAIL.d]) {
    out.push(S(k.slabOf({ x: RAIL.x - 2, y, w: RAIL.w + 4, d: 4, r: 1 }, 0, 7, P, 3, 0.4), { tone: "mid" }));
    out.push(D([at([RAIL.x + 1, y + 2, 7]), at([RAIL.x + RAIL.w - 1, y + 2, 7])], { size: 0.42 }));
  }
  return out.join("");
}

function slider() {
  const out = [];
  // The nub reaches across to the box wall: the card it points at is the one the key lifts.
  out.push(S(k.slabOf({ x: BOX.x + BOX.w, y: -1, w: SLIDER.x - BOX.x - BOX.w, d: 2, r: 0.3 }, 4, 3, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf(SLIDER, 3, 6, P, 3, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(50, 0, 3, 9, 4, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(50, 0, 3, 9, 13, 20, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([50, 0], [47.6, 0], 13, P), { tone: "hi" }));
  return out.join("");
}

function key() {
  const out = [];
  out.push(S(k.slabOf({ x: RAIL.x + RAIL.w, y: 25, w: KEY.x - RAIL.x - RAIL.w, d: 4, r: 0.6 }, 1, 3, P, 2), { tone: "mid" }));
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
    k.faceTextSvg(k.topMatrix([KEY.x + KEY.w / 2, KEY.y + KEY.d / 2 + 2.4], 16.6, P, "x"), "G", { size: 7, tone: "mid", anchor: "middle" }),
  ].join("");
}

const slideTo = (index) => CARD_Y[index] + CARD.t / 2;
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "Gtab drawn as a card index box. Four cards stand in the box, one for each saved workspace, with its pane layout on the face. A slider picks a card and one key lifts it out of the box.",
  body: [
    bench(P, PLATE, { ruler: { x: -78, y: 44, w: 120, d: 6, r: 1 }, label: { x: 66, y: -48, w: 34, d: 18, r: 1.2 } }),
    box(),
    ...WORKSPACES.map((_, index) => card(index)),
    nearWalls(),
    selector(),
    `<g data-part="slider" transform="${k.translateAlong(P, [0, slideTo(0), 0])}">${slider()}</g>`,
    key(),
    `<g data-part="keycap">${keycap()}</g>`,
  ],
});

export const figure = { name: "gtab", svg, params: { P, slide: CARD_Y.map((_, i) => slideTo(i)), lift: LIFT, travel: TRAVEL, workspaces: WORKSPACES } };
