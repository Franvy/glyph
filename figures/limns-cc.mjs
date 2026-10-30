// limns.cc: one carriage with four stamping heads over a single platen. Three heads write text, one makes a picture.
// The carriage brings the chosen head over the paper and it stamps: many models, one place.
import { D, HEIGHT, k, L, S, WIDTH, bench, screws } from "./common.mjs";

const HEADS = [
  { x: -24, kind: "chat" },
  { x: -8, kind: "chat" },
  { x: 8, kind: "image" },
  { x: 24, kind: "chat" },
];
const PLATE = { x: -86, y: -36, w: 172, d: 96, r: 8 };
const POST = { w: 8, d: 8, y: -14 };
const POST_X = [-80, 72];
const BEAM = { x: -82, y: -15, w: 164, d: 10, r: 1.2 };
const BEAM_Z = 58;
const BEAM_H = 7;
const CARRIAGE = { x: -34, y: -5, w: 68, d: 6, r: 1 };
const HEAD_Y = 5; // head axis: tangent to the carriage face
const HEAD_R = 4;
const BODY = [36, 52];
const ROD_R = 1.8;
const ROD = 16; // rod length below the body
const PLATEN = { x: -24, y: -8, w: 48, d: 26, r: 2 };
const PLATEN_H = 14;
const PAPER = k.insetPlan(PLATEN, 3);
const PAPER_Z = PLATEN_H + 0.4;
const TIP_H = 2;
const REST_TIP = BODY[0] - ROD - TIP_H; // the tip's bottom at rest
const STROKE = REST_TIP - PAPER_Z;
const KNOB = [56, 36];

const P = k.fitProjection([...k.boxCorners(PLATE, -15, 0), [BEAM.x, BEAM.y, BEAM_Z + BEAM_H + 1], [BEAM.x + BEAM.w, BEAM.y + BEAM.d, BEAM_Z + BEAM_H + 1]], WIDTH, HEIGHT, { pad: 22, azimuth: 50 });
const at = (p) => k.iso(p, P);

function post(x) {
  const plan = { x, y: POST.y, w: POST.w, d: POST.d, r: 1.2 };
  const foot = { x: x - 3, y: POST.y - 3, w: POST.w + 6, d: POST.d + 6, r: 2 };
  return [
    S(k.slabOf(foot, 0, 4, P, 3, 0.5), { tone: "mid" }),
    screws(P, [[foot.x + 2, foot.y + 2], [foot.x + foot.w - 2, foot.y + foot.d - 2]], 4, { r: 0.8, size: 0.34 }),
    S(k.slabOf(plan, 4, BEAM_Z - 4, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, 14, P, 3), { tone: "faint" }) }),
  ].join("");
}

function platen() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(PLATEN, 2), 0, 0.1, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.slabOf(PLATEN, 0, PLATEN_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(PLATEN, 4, P, 4), { tone: "faint" }) }));
  out.push(S(k.slabOf(PAPER, PLATEN_H, 0.4, P, 2), { tone: "hi", crease: "none" }));
  // Two clips hold the sheet at its back corners.
  for (const x of [PAPER.x + 3, PAPER.x + PAPER.w - 9]) out.push(S(k.slabOf({ x, y: PAPER.y - 1, w: 6, d: 4, r: 0.6 }, PAPER_Z, 1.2, P, 2), { tone: "mid" }));
  return out.join("");
}

/** What a head leaves on the paper: lines of text from a chat head, a framed picture from the image head. */
function prints() {
  const z = PAPER_Z;
  const x0 = PAPER.x + 5;
  const text = [0.8, 0.62, 0.74, 0.4].map((share, i) => k.lineOnTop([x0, PAPER.y + 7 + i * 3.6], [x0 + (PAPER.w - 10) * share, PAPER.y + 7 + i * 3.6], z, P)).join("");
  const frame = { x: PAPER.x + 10, y: PAPER.y + 4, w: PAPER.w - 20, d: PAPER.d - 8, r: 0.6 };
  const fx = [frame.x, frame.x + frame.w];
  const picture =
    k.planOutline(frame, z, P, 2) +
    k.onTop([[fx[0], frame.y + frame.d * 0.78], [frame.x + frame.w * 0.35, frame.y + frame.d * 0.42], [frame.x + frame.w * 0.55, frame.y + frame.d * 0.6], [frame.x + frame.w * 0.72, frame.y + frame.d * 0.36], [fx[1], frame.y + frame.d * 0.7]], z, P);
  const sun = k.ring(frame.x + frame.w * 0.24, frame.y + frame.d * 0.3, 1.8, z, P, 16);
  return `<g data-print="chat" style="opacity:0">${L(text, { tone: "lo", free: true })}</g><g data-print="image">${L(picture + sun, { tone: "lo" })}</g>`;
}

function beam() {
  const out = [S(k.slabOf(BEAM, BEAM_Z, BEAM_H, P, 3, 0.6), { tone: "mid" })];
  // A ruler strip on the beam with a detent for each head's working position.
  const strip = { x: -52, y: BEAM.y + 1.4, w: 104, d: 4, r: 0.6 };
  out.push(S(k.slabOf(strip, BEAM_Z + BEAM_H, 0.5, P, 2), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 4, strip.y, BEAM_Z + BEAM_H + 0.5, [1.4, 2.8], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  for (const x of [BEAM.x + 14, BEAM.x + BEAM.w - 18]) out.push(S(k.slabOf({ x, y: BEAM.y, w: 4, d: BEAM.d, r: 0.6 }, BEAM_Z + BEAM_H, 3, P, 2, 0.3), { tone: "mid" }));
  out.push(screws(P, POST_X.map((x) => [x + POST.w / 2, BEAM.y + BEAM.d / 2]), BEAM_Z + BEAM_H, { r: 1.2, size: 0.4 }));
  return out.join("");
}

function carriage() {
  const out = [S(k.slabOf(CARRIAGE, BODY[0] + 4, BEAM_Z + BEAM_H - BODY[0] - 4, P, 3, 0.5), { tone: "mid" })];
  out.push(D([-30, 30].flatMap((x) => [at([x, CARRIAGE.y + CARRIAGE.d, BODY[1] + 2]), at([x, CARRIAGE.y + CARRIAGE.d, BEAM_Z + 2])]), { size: 0.42 }));
  // The pointer that reads the ruler, at the carriage's centre.
  out.push(S(k.slabOf({ x: -1.2, y: BEAM.y + 1, w: 2.4, d: BEAM.d - 1, r: 0.4 }, BEAM_Z + BEAM_H, 1.4, P, 2), { tone: "hi", crease: "lo" }));
  return out.join("");
}

function head(h, index) {
  const tip = h.kind === "image"
    ? k.slabOf({ x: h.x - 3.2, y: HEAD_Y - 3.2, w: 6.4, d: 6.4, r: 0.6 }, REST_TIP, TIP_H, P, 2)
    : k.cylinder(h.x, HEAD_Y, 3.2, REST_TIP, TIP_H, P, 20);
  return [
    `<g data-part="rod" data-index="${index}">`,
    S(k.cylinder(h.x, HEAD_Y, ROD_R, REST_TIP + TIP_H, BODY[0] - REST_TIP - TIP_H + 4, P, 16), { tone: "mid", crease: "none" }),
    S(tip, { tone: "mid" }),
    "</g>",
    S(k.cylinder(h.x, HEAD_Y, HEAD_R, BODY[0], BODY[1] - BODY[0], P, 28, 0.5), { tone: "mid" }),
    L(k.sideArc(h.x, HEAD_Y, HEAD_R, BODY[0] + 4, P, 20) + k.sideArc(h.x, HEAD_Y, HEAD_R, BODY[1] - 5, P, 20), { tone: "faint" }),
    L(k.knurl(h.x, HEAD_Y, HEAD_R, BODY[1] - 5, BODY[1], 18, P), { tone: "lo" }),
    L(k.ring(h.x, HEAD_Y, 1.2, BODY[1], P, 12), { tone: "mid" }),
  ].join("");
}

const KNOB_ANGLES = HEADS.map((_, i) => -Math.PI * 0.45 + i * Math.PI * 0.3);
const knobPointer = (angle) => k.lineOnTop([KNOB[0], KNOB[1]], [KNOB[0] + Math.sin(angle) * 4.6, KNOB[1] - Math.cos(angle) * 4.6], 9, P);
function knob() {
  const [x, y] = KNOB;
  const out = [S(k.slabOf({ x: x - 10, y: y - 10, w: 20, d: 20, r: 2 }, 0, 4, P, 3, 0.5), { tone: "mid" })];
  // Four stops, one for each head.
  out.push(L(k.ring(x, y, 6.4, 4, P, 40), { tone: "lo" }));
  out.push(L(KNOB_ANGLES.map((a) => k.lineOnTop([x + Math.sin(a) * 6.4, y - Math.cos(a) * 6.4], [x + Math.sin(a) * 8.6, y - Math.cos(a) * 8.6], 4, P)).join(""), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 5, 4, 5, P, 28), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 5, 4, 9, 28, P), { tone: "lo" }));
  return out.join("");
}

const home = 2;
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "limns.cc drawn as a stamping carriage. Four heads hang from one carriage: three write text and one makes a picture. The carriage brings the chosen head over a single sheet of paper, and the head stamps its answer.",
  body: [
    bench(P, PLATE, { ruler: { x: -74, y: 46, w: 108, d: 6, r: 1 }, label: { x: -74, y: 24, w: 30, d: 14, r: 1.2 } }),
    knob(),
    `<path data-part="pointer" class="iso-line" data-tone="hi" data-free="end" d="${knobPointer(KNOB_ANGLES[home])}"/>`,
    D([at([KNOB[0], KNOB[1], 9])], { size: 0.5, tone: "hi" }),
    ...POST_X.map(post),
    platen(),
    prints(),
    beam(),
    `<g data-part="carriage" transform="${k.translateAlong(P, [-HEADS[home].x, 0, 0])}">${carriage()}${HEADS.map(head).join("")}</g>`,
  ],
});

export const figure = { name: "limns-cc", svg, params: { P, heads: HEADS, stroke: STROKE, knob: KNOB, angles: KNOB_ANGLES, home } };
