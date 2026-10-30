// Shared parts for the three project figures: the bench every machine stands on.
import * as k from "./kit/iso-kit.mjs";

export { k };
export const WIDTH = 600;
export const HEIGHT = 386; // the 311 x 200 preview frame of a project card

export const S = (paths, style) => k.solidSvg(paths, style);
export const L = (d, style) => k.lineSvg(d, style);
export const D = (points, style) => k.dotsSvg(points, style);

export function byDepthOf(P) {
  return (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
}

/** A base plate on four feet with a groove, corner screws, a ruler strip and a label plate. */
export function bench(P, plate, { height = 10, foot = 5, ruler, label } = {}) {
  const at = (p) => k.iso(p, P);
  const out = [`<path class="iso-halo" d="${k.haloOf(plate, -height - foot, height, P)}"/>`];
  for (const [x, y] of byDepthOf(P)(k.corners(plate, 20))) {
    out.push(S(k.cylinder(x, y, 6.4, -height - foot, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5, -height - foot + 1.6, foot - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(plate, -height, height, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(plate, -height + 3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(plate, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(plate, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  if (ruler) {
    out.push(S(k.slabOf(ruler, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
    const ticks = k.topTicks(ruler.x + 4, ruler.x + ruler.w - 4, 4, 5, ruler.y, 0.6, [2, 3.6], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
    out.push(D([at([ruler.x + 2, ruler.y + ruler.d / 2, 0.6]), at([ruler.x + ruler.w - 2, ruler.y + ruler.d / 2, 0.6])], { size: 0.45 }));
  }
  if (label) out.push(labelPlate(P, label));
  return out.join("");
}

/** A small engraved plate: an inset outline, three rule lines that stand for printed text, two screws. */
export function labelPlate(P, plan) {
  const at = (p) => k.iso(p, P);
  const z = 0.8;
  const out = [S(k.slabOf(plan, 0, z, P, 4), { tone: "lo", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 1.6), z, P, 4), { tone: "faint" }));
  const x0 = plan.x + 5;
  [0.62, 0.42, 0.52].forEach((share, index) => {
    const y = plan.y + 4.5 + index * ((plan.d - 9) / 2);
    out.push(L(k.lineOnTop([x0, y], [x0 + (plan.w - 12) * share, y], z, P), { tone: "lo", free: true }));
  });
  out.push(D([at([plan.x + plan.w - 3.2, plan.y + 3.2, z]), at([plan.x + plan.w - 3.2, plan.y + plan.d - 3.2, z])], { size: 0.4 }));
  return out.join("");
}

/** Screw heads on a top face: a ring and a dot each. */
export function screws(P, points, z, { r = 1.4, size = 0.42 } = {}) {
  return L(points.map(([x, y]) => k.ring(x, y, r, z, P, 12)).join(""), { tone: "lo" }) + D(points.map(([x, y]) => k.iso([x, y, z], P)), { size });
}
