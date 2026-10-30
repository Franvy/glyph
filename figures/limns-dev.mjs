// limns.dev: a light table. Slides of every size lie on the glass in masonry columns, like shots on the board.
// A loupe on a gantry visits them; the slide under it lifts and lights, and keeps a pin: saved.
import { D, HEIGHT, k, L, S, WIDTH, bench, screws, byDepthOf } from "./common.mjs";

const PLATE = { x: -104, y: -64, w: 192, d: 128, r: 8 };
const TABLE = { x: -88, y: -52, w: 152, d: 104, r: 3 };
const PAD = 2; // rubber pads under the table
const TOP = PAD + 13; // the glass
const GLASS = k.insetPlan(TABLE, 4);
const COL_W = 22;
const COL_X = [-80, -54, -28, -2, 24];
// Masonry: the depth of each slide, back to front, column by column.
const COLUMNS = [
  [30, 20, 26],
  [18, 34, 24],
  [26, 22, 28],
  [22, 30, 24],
  [34, 18, 26],
];
const GAP = 4;
const MOUNT_H = 1.2;
const RISE = 4;
const RAIL_Z = TOP + 3;
const UP_H = 20;
const BEAM_Z = RAIL_Z + UP_H;
const ARM = 15; // loupe centre ahead of the beam centre, in x
const LOUPE_R = 8;

const SLIDES = COLUMNS.flatMap((depths, col) => {
  let y = GLASS.y + 2;
  return depths.map((d, row) => {
    const plan = { x: COL_X[col], y, w: COL_W, d, r: 1 };
    y += d + GAP;
    return { col, row, plan, cx: plan.x + COL_W / 2, cy: plan.y + d / 2, motif: (col * 3 + row) % 4 };
  });
});

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -15, 0), [COL_X[0] - ARM, GLASS.y - 2, BEAM_Z + 6], [COL_X[4] + COL_W, GLASS.y + GLASS.d + 2, BEAM_Z + 6]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 40 },
);
const at = (p) => k.iso(p, P);

function table() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(TABLE, 3), 0, 0.1, P)}" style="filter:blur(3px)"/>`];
  for (const [x, y] of byDepthOf(P)(k.corners(TABLE, 8))) out.push(S(k.cylinder(x, y, 4, 0, PAD, P, 20), { tone: "lo" }));
  out.push(S(k.slabOf(TABLE, PAD, TOP - PAD, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(TABLE, PAD + 3, P, 4), { tone: "faint" }) }));
  // The opal glass the lamps shine through, set into the frame.
  out.push(S(k.slabOf(GLASS, TOP - 0.4, 0.4, P, 3), { tone: "hi", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(GLASS, 1.2), TOP, P, 3), { tone: "faint" }));
  // Vent slots on the near long face.
  const vents = k.sideMatrix([TABLE.x + 20, TABLE.y + TABLE.d], TOP - 3, P, "left");
  const slots = Array.from({ length: 9 }, (_, i) => `M${i * 7} 0h4a.8 .8 0 0 1 0 1.6h-4a.8 .8 0 0 1 0-1.6Z`).join("");
  out.push(`<g transform="${vents}"><path class="iso-line" data-tone="lo" d="${slots}"/></g>`);
  return out.join("");
}

function rail(y) {
  const plan = { x: TABLE.x, y, w: TABLE.w, d: 4, r: 0.8 };
  return S(k.slabOf(plan, TOP, RAIL_Z - TOP, P, 2, 0.4), { tone: "mid" }) + D([at([TABLE.x + 3, y + 2, RAIL_Z]), at([TABLE.x + TABLE.w - 3, y + 2, RAIL_Z])], { size: 0.42 });
}

/** A slide mount with its picture: a window and a few lines that stand for the shot. */
function slide(s, index) {
  const { plan } = s;
  const win = k.insetPlan(plan, 3);
  const z = TOP + MOUNT_H;
  const [x0, y0, x1, y1] = [win.x, win.y, win.x + win.w, win.y + win.d];
  const art = [
    () => k.onTop([[x0, y0 + win.d * 0.62], [x1, y0 + win.d * 0.62]], z, P) + k.ring(x0 + win.w * 0.64, y0 + win.d * 0.34, Math.min(win.w, win.d) * 0.16, z, P, 20),
    () => k.onTop([[x0, y1], [x0 + win.w * 0.45, y0 + win.d * 0.3], [x1, y1]], z, P),
    () => k.onTop([[x0, y0 + win.d * 0.33], [x1, y0 + win.d * 0.33]], z, P) + k.onTop([[x0, y0 + win.d * 0.66], [x1, y0 + win.d * 0.66]], z, P) + k.onTop([[x0 + win.w / 2, y0], [x0 + win.w / 2, y1]], z, P),
    () => k.planOutline({ x: x0 + win.w * 0.25, y: y0 + win.d * 0.25, w: win.w * 0.5, d: win.d * 0.5, r: 0.6 }, z, P, 2),
  ][s.motif]();
  const pin = [plan.x + 3, plan.y + 3];
  return [
    `<g data-part="slide" data-index="${index}">`,
    S(k.slabOf(plan, TOP, MOUNT_H, P, 2), { tone: "hi", crease: "lo" }),
    L(k.planOutline(win, z, P, 2), { tone: "mid" }),
    L(art, { tone: "lo" }),
    `<g data-part="pin" style="opacity:0">${S(k.cylinder(pin[0], pin[1], 1.5, z, 1.6, P, 14), { tone: "hi", crease: "lo" })}</g>`,
    "</g>",
  ].join("");
}

function upright(y) {
  const plan = { x: -4, y, w: 8, d: 8, r: 1.2 };
  return S(k.slabOf(plan, RAIL_Z, UP_H, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, RAIL_Z + 4, P, 3), { tone: "faint" }) }) +
    S(k.slabOf({ x: -6, y: y - 1, w: 12, d: 10, r: 1.5 }, RAIL_Z, 3, P, 3, 0.4), { tone: "mid" });
}

function beam() {
  const plan = { x: -3, y: TABLE.y - 2, w: 6, d: TABLE.d + 4, r: 1 };
  return S(k.slabOf(plan, BEAM_Z, 5, P, 3, 0.5), { tone: "mid" }) + screws(P, [[0, TABLE.y + 2], [0, TABLE.y + TABLE.d - 2]], BEAM_Z + 5, { r: 1, size: 0.38 });
}

/** The loupe on its carriage: a block on the beam's face, an arm, and a turned body with a knurled focus ring. */
function loupe() {
  const out = [];
  const z0 = BEAM_Z - 14; // the lens rim, clear of a lifted slide
  // The carriage rides the beam's near face and holds the loupe body side on.
  out.push(S(k.slabOf({ x: 3, y: -6, w: ARM - LOUPE_R - 3, d: 12, r: 0.8 }, z0 + 4, BEAM_Z + 5 - z0 - 4, P, 2, 0.4), { tone: "mid" }));
  out.push(D([at([ARM - LOUPE_R - 0.8, -4, BEAM_Z + 5]), at([ARM - LOUPE_R - 0.8, 4, BEAM_Z + 5])], { size: 0.38 }));
  out.push(S(k.cylinder(ARM, 0, LOUPE_R - 1.4, z0, 2, P, 40), { tone: "lo" }));
  out.push(S(k.cylinder(ARM, 0, LOUPE_R, z0 + 2, 10, P, 48, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(ARM, 0, LOUPE_R, z0 + 6, z0 + 10, 40, P), { tone: "lo" }));
  out.push(L(k.sideArc(ARM, 0, LOUPE_R, z0 + 6, P, 32) + k.sideArc(ARM, 0, LOUPE_R, z0 + 10, P, 32), { tone: "faint" }));
  out.push(L(k.ring(ARM, 0, LOUPE_R - 2, z0 + 12, P, 40), { tone: "lo" }));
  out.push(L(k.ring(ARM, 0, 2.4, z0 + 12, P, 20), { tone: "mid" }));
  return out.join("");
}

function dimmer() {
  const out = [];
  const [x, y] = [76, 36];
  out.push(S(k.slabOf({ x: x - 9, y: y - 9, w: 18, d: 18, r: 2 }, 0, 4, P, 3, 0.5), { tone: "mid" }));
  const t = k.radialTicks(x, y, 7, 12, 3, 4, [1, 1.8], P, -Math.PI * 0.75, Math.PI * 1.5);
  out.push(L(k.ring(x, y, 7, 4, P, 40), { tone: "lo" }), L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 5, 4, 4, P, 28), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 5, 4, 8, 28, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([x, y], [x + 3.4, y - 3.4], 8, P), { tone: "hi" }), D([at([x, y, 8])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

const slides = SLIDES.map((s, i) => ({ s, i })).sort((a, b) => k.depthOf([a.s.cx, a.s.cy, 0], P) - k.depthOf([b.s.cx, b.s.cy, 0], P));
// The tour: a few slides, chosen across the board.
const TOUR = [7, 1, 12, 5, 10, 3];
const home = SLIDES[TOUR[0]];
const gx = (s) => s.cx - ARM;
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "limns.dev drawn as a light table. Slides of different sizes lie on the glass in masonry columns, like shots on the board. A loupe on a gantry visits them; the slide under it lifts and lights, and keeps a pin when it is saved.",
  body: [
    bench(P, PLATE, { ruler: { x: -92, y: 54, w: 150, d: 6, r: 1 }, label: { x: 67, y: -50, w: 15, d: 28, r: 1.2 } }),
    dimmer(),
    table(),
    rail(TABLE.y),
    `<g data-part="gantry-back" transform="${k.translateAlong(P, [gx(home), 0, 0])}">${upright(TABLE.y - 2)}</g>`,
    ...slides.map(({ s, i }) => slide(s, i)),
    rail(TABLE.y + TABLE.d - 4),
    `<g data-part="gantry" transform="${k.translateAlong(P, [gx(home), 0, 0])}">${beam()}<g data-part="loupe" transform="${k.translateAlong(P, [0, home.cy, 0])}">${loupe()}</g>${upright(TABLE.y + TABLE.d - 6)}</g>`,
  ],
});

export const figure = { name: "limns-dev", svg, params: { P, stops: TOUR.map((i) => ({ i, x: gx(SLIDES[i]), y: SLIDES[i].cy })), rise: RISE } };
