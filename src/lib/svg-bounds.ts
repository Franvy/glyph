// Where an icon actually draws, so every skill icon can fill the same 14px square. Pasted icons leave very different
// margins around the drawing. Curves and arcs are sampled, which is exact enough at icon size.

export type SvgNode = { name: string; attrs: [string, string][]; children: SvgNode[] };
type Matrix = [number, number, number, number, number, number];
type Box = { minX: number; minY: number; maxX: number; maxY: number };
type Context = { m: Matrix; fill: string; stroke: string; strokeWidth: number };

const SAMPLES = 32;
/** Not drawn where they stand: they are used by reference, or only change pixels. */
const NOT_DRAWN = new Set(["defs", "clipPath", "mask", "symbol", "linearGradient", "radialGradient", "filter", "use"]);
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const multiply = ([a, b, c, d, e, f]: Matrix, [A, B, C, D, E, F]: Matrix): Matrix => [
  a * A + c * B,
  b * A + d * B,
  a * C + c * D,
  b * C + d * D,
  a * E + c * F + e,
  b * E + d * F + f,
];

function parseTransform(value: string): Matrix {
  let m = IDENTITY;
  for (const [, fn, args] of value.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const n = (args.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    const rad = ((n[0] ?? 0) * Math.PI) / 180;
    let t: Matrix = IDENTITY;
    if (fn === "matrix" && n.length === 6) t = n as Matrix;
    else if (fn === "translate") t = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0];
    else if (fn === "scale") t = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0];
    else if (fn === "rotate") {
      const [cx, cy] = [n[1] ?? 0, n[2] ?? 0];
      t = multiply(multiply([1, 0, 0, 1, cx, cy], [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    } else if (fn === "skewX") t = [1, 0, Math.tan(rad), 1, 0, 0];
    else if (fn === "skewY") t = [1, Math.tan(rad), 0, 1, 0, 0];
    m = multiply(m, t);
  }
  return m;
}

/** Reads numbers and one-character arc flags from path data. Stops at anything it cannot read. */
class Scanner {
  i = 0;
  constructor(private s: string) {}
  private skip() {
    while (this.i < this.s.length && /[\s,]/.test(this.s[this.i])) this.i++;
  }
  command(): string | null {
    this.skip();
    const c = this.s[this.i];
    if (c && /[a-z]/i.test(c) && !/e/i.test(c)) {
      this.i++;
      return c;
    }
    return null;
  }
  hasNumber() {
    this.skip();
    return /[-+.\d]/.test(this.s[this.i] ?? "");
  }
  number(): number {
    this.skip();
    const m = /^[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/i.exec(this.s.slice(this.i));
    if (!m) throw new Error("bad number");
    this.i += m[0].length;
    return Number(m[0]);
  }
  flag(): number {
    this.skip();
    const c = this.s[this.i++];
    if (c !== "0" && c !== "1") throw new Error("bad flag");
    return Number(c);
  }
}

/** Every point a path passes through, with curves and arcs sampled. Broken path data ends the path where it breaks. */
function pathPoints(d: string, emit: (x: number, y: number) => void) {
  const s = new Scanner(d);
  let [x, y, startX, startY] = [0, 0, 0, 0];
  let [ctrlX, ctrlY] = [0, 0]; // the last control point, for S and T
  let prev = "";
  try {
    for (let cmd = s.command(); cmd; ) {
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      const ox = rel ? x : 0;
      const oy = rel ? y : 0;
      const at = (px: number, py: number) => emit(px, py);
      if (C === "Z") {
        [x, y] = [startX, startY];
        at(x, y);
      } else if (C === "M" || C === "L" || C === "T") {
        let tx: number, ty: number;
        [tx, ty] = [s.number() + ox, s.number() + oy];
        if (C === "T") {
          const [qx, qy] = /[QT]/i.test(prev) ? [2 * x - ctrlX, 2 * y - ctrlY] : [x, y];
          for (let k = 1; k <= SAMPLES; k++) {
            const t = k / SAMPLES;
            at((1 - t) ** 2 * x + 2 * (1 - t) * t * qx + t * t * tx, (1 - t) ** 2 * y + 2 * (1 - t) * t * qy + t * t * ty);
          }
          [ctrlX, ctrlY] = [qx, qy];
        }
        [x, y] = [tx, ty];
        if (C === "M") [startX, startY] = [x, y];
        at(x, y);
      } else if (C === "H") {
        x = s.number() + ox;
        at(x, y);
      } else if (C === "V") {
        y = s.number() + oy;
        at(x, y);
      } else if (C === "C" || C === "S" || C === "Q") {
        let x1: number, y1: number;
        if (C === "S") [x1, y1] = /[CS]/i.test(prev) ? [2 * x - ctrlX, 2 * y - ctrlY] : [x, y];
        else [x1, y1] = [s.number() + ox, s.number() + oy];
        const [x2, y2] = C === "Q" ? [x1, y1] : [s.number() + ox, s.number() + oy];
        const [ex, ey] = [s.number() + ox, s.number() + oy];
        for (let k = 1; k <= SAMPLES; k++) {
          const t = k / SAMPLES;
          const u = 1 - t;
          if (C === "Q") at(u * u * x + 2 * u * t * x1 + t * t * ex, u * u * y + 2 * u * t * y1 + t * t * ey);
          else at(u ** 3 * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * ex, u ** 3 * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * ey);
        }
        [ctrlX, ctrlY] = [x2, y2];
        [x, y] = [ex, ey];
      } else if (C === "A") {
        const [rx0, ry0, angle] = [s.number(), s.number(), s.number()];
        const [large, sweep] = [s.flag(), s.flag()];
        const [ex, ey] = [s.number() + ox, s.number() + oy];
        arcPoints(x, y, Math.abs(rx0), Math.abs(ry0), angle, large, sweep, ex, ey, at);
        [x, y] = [ex, ey];
      } else return;
      prev = C;
      const next = s.command();
      if (next) cmd = next;
      else if (s.hasNumber()) cmd = C === "M" ? (rel ? "l" : "L") : cmd; // numbers after a command repeat it
      else cmd = null;
    }
  } catch {
    // Broken path data: the browser also stops drawing where it breaks.
  }
}

/** Samples an SVG arc (endpoint form) through its centre form, as in SVG 1.1 appendix F.6.5. */
function arcPoints(
  x1: number, y1: number, rx: number, ry: number, angle: number, large: number, sweep: number,
  x2: number, y2: number, at: (x: number, y: number) => void,
) {
  if (rx === 0 || ry === 0) return at(x2, y2);
  const phi = (angle * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const scale = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (scale > 1) [rx, ry] = [rx * Math.sqrt(scale), ry * Math.sqrt(scale)];
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const theta = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = theta(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = theta((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  for (let k = 1; k <= SAMPLES; k++) {
    const t = t1 + (dt * k) / SAMPLES;
    at(cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos);
  }
}

const visible = (paint: string) => !/^(none|transparent)$/i.test(paint.trim());
/** A length in user units. A percentage or a unit makes the shape depend on the viewport: it is not measured. */
const length = (v: string | undefined, fallback = 0) => (v === undefined ? fallback : /^\s*[-+]?[\d.]+(e[-+]?\d+)?\s*$/i.test(v) ? Number(v) : NaN);

/** The points of one shape, in its own coordinates. */
function shapePoints(node: SvgNode, a: Map<string, string>, emit: (x: number, y: number) => void) {
  const ellipse = (cx: number, cy: number, rx: number, ry: number) => {
    for (let k = 0; k < SAMPLES; k++) {
      const t = (2 * Math.PI * k) / SAMPLES;
      emit(cx + rx * Math.cos(t), cy + ry * Math.sin(t));
    }
  };
  const n = (k: string, fallback = 0) => length(a.get(k), fallback);
  switch (node.name) {
    case "path":
      return pathPoints(a.get("d") ?? "", emit);
    case "rect": {
      const [x, y, w, h] = [n("x"), n("y"), n("width"), n("height")];
      if ([x, y, w, h].some(Number.isNaN) || w <= 0 || h <= 0) return;
      return [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([px, py]) => emit(px, py));
    }
    case "circle":
      return ellipse(n("cx"), n("cy"), n("r"), n("r"));
    case "ellipse":
      return ellipse(n("cx"), n("cy"), n("rx"), n("ry"));
    case "line":
      emit(n("x1"), n("y1"));
      return emit(n("x2"), n("y2"));
    case "polyline":
    case "polygon": {
      const p = (a.get("points") ?? "").match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
      for (let k = 0; k + 1 < p.length; k += 2) emit(p[k], p[k + 1]);
    }
  }
}

function walk(node: SvgNode, parent: Context, box: Box) {
  const a = new Map(node.attrs);
  if (a.get("display") === "none" || a.get("visibility") === "hidden" || Number(a.get("opacity") ?? 1) === 0) return;
  const ctx: Context = {
    m: a.has("transform") ? multiply(parent.m, parseTransform(a.get("transform")!)) : parent.m,
    fill: a.get("fill") ?? parent.fill,
    stroke: a.get("stroke") ?? parent.stroke,
    strokeWidth: a.has("stroke-width") ? length(a.get("stroke-width"), 1) : parent.strokeWidth,
  };
  if (node.name === "g" || node.name === "svg") {
    for (const child of node.children) if (!NOT_DRAWN.has(child.name)) walk(child, ctx, box);
    return;
  }
  const stroked = visible(ctx.stroke) && ctx.strokeWidth > 0;
  const filled = visible(ctx.fill) && node.name !== "line";
  if (!stroked && !filled) return;

  const [ma, mb, mc, md, me, mf] = ctx.m;
  // Half the stroke sticks out on each side, scaled with the shape.
  const pad = stroked ? (ctx.strokeWidth / 2) * Math.sqrt(Math.abs(ma * md - mb * mc)) : 0;
  shapePoints(node, a, (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const px = ma * x + mc * y + me;
    const py = mb * x + md * y + mf;
    box.minX = Math.min(box.minX, px - pad);
    box.minY = Math.min(box.minY, py - pad);
    box.maxX = Math.max(box.maxX, px + pad);
    box.maxY = Math.max(box.maxY, py + pad);
  });
}

const round = (n: number) => Number(n.toFixed(3)) + 0; // + 0 turns -0 into 0

/**
 * A square viewBox around what the icon draws, with the drawing in the middle.
 * Null when nothing is measured (for example, an icon made only of <use>): the caller keeps its own viewBox.
 */
export function squareBounds(root: SvgNode, rootFill: string): number[] | null {
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  walk(root, { m: IDENTITY, fill: rootFill, stroke: "none", strokeWidth: 1 }, box);
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  const side = Math.max(w, h);
  if (!Number.isFinite(side) || side <= 0) return null;
  return [box.minX - (side - w) / 2, box.minY - (side - h) / 2, side, side].map(round);
}
