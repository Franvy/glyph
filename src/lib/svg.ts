// SVG code pasted in /admin for a skill icon. The home page puts it inline, so it can follow the text colour, and an
// inline SVG runs on this origin. So the code is parsed and written out again from an allowlist: only shapes and paint,
// no scripts, no event handlers, no links out, no <style>. Anything else that could run or load a file is refused.
// Then every icon is made to match the others: one colour (the text colour) and one size (the drawing fills 14px).
import { squareBounds, type SvgNode as Node } from "./svg-bounds";

export type SvgCheck = { ok: true; svg: string } | { ok: false; error: string };

/** The size of an icon on a skill chip, in px. Every icon is square. */
const ICON_SIZE = 14;
/** Relative luminance from which a colour counts as light. Light parts of a two-tone icon become cut-outs. */
const LIGHT = 0.6;
const MAX_LENGTH = 32_000;
const MAX_ELEMENTS = 1_000;

const ELEMENTS = [
  "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
  "defs", "symbol", "use", "clipPath", "mask", "linearGradient", "radialGradient", "stop",
  // Filters only change pixels. feImage is left out: it loads an image from its href.
  "filter", "feBlend", "feColorMatrix", "feComponentTransfer", "feFuncR", "feFuncG", "feFuncB", "feFuncA",
  "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feSpecularLighting", "feDistantLight", "fePointLight",
  "feSpotLight", "feDisplacementMap", "feDropShadow", "feFlood", "feGaussianBlur", "feMerge", "feMergeNode",
  "feMorphology", "feOffset", "feTile", "feTurbulence",
];
const ATTRIBUTES = [
  "id", "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "width", "height",
  "points", "pathLength", "viewBox", "preserveAspectRatio", "transform", "href",
  "fill", "fill-rule", "fill-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "opacity",
  "clip-path", "clip-rule", "mask", "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform",
  "spreadMethod", "clipPathUnits", "maskUnits", "maskContentUnits", "vector-effect", "shape-rendering",
  "paint-order", "display", "visibility",
  "filter", "filterUnits", "primitiveUnits", "color-interpolation-filters", "in", "in2", "result", "mode",
  "type", "values", "tableValues", "slope", "intercept", "amplitude", "exponent", "operator", "k1", "k2", "k3", "k4",
  "stdDeviation", "edgeMode", "dx", "dy", "flood-color", "flood-opacity", "radius", "order", "kernelMatrix",
  "divisor", "bias", "targetX", "targetY", "preserveAlpha", "surfaceScale", "diffuseConstant", "specularConstant",
  "specularExponent", "lighting-color", "azimuth", "elevation", "z", "pointsAtX", "pointsAtY", "pointsAtZ",
  "limitingConeAngle", "scale", "xChannelSelector", "yChannelSelector", "baseFrequency", "numOctaves", "seed",
  "stitchTiles",
];
// Not kept: style and color. A style can resize the icon or paint it, and color changes what currentColor means.
// SVG names are case-sensitive (viewBox, clipPath). A paste may not be, so match without case and write the real name.
const byLower = (names: string[]) => new Map(names.map((n) => [n.toLowerCase(), n]));
const ELEMENT_NAMES = byLower(ELEMENTS);
const ATTRIBUTE_NAMES = byLower(ATTRIBUTES);
/** Written by design tools, never shown: dropped with everything inside them. */
const DROPPED = new Set(["title", "desc", "metadata"]);

const TAG = /<([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/y;
const CLOSE = /<\/([A-Za-z_][\w:.-]*)\s*>/y;
const ATTR = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const SKIP = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>/iy;

const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (all, e: string) => {
    const lower = e.toLowerCase();
    if (lower[0] === "#") {
      const code = lower[1] === "x" ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[lower] ?? all;
  });
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fail = (error: string): SvgCheck => ({ ok: false, error });

/** Checks one attribute. Returns the name to keep, null to drop it, or an error. */
function checkAttribute(raw: string, value: string): { keep: string | null } | { error: string } {
  const lower = raw.toLowerCase();
  if (lower.startsWith("on")) return { error: `The SVG has an "${raw}" attribute, which runs code. Remove it and paste again.` };
  const name = lower === "xlink:href" ? "href" : ATTRIBUTE_NAMES.get(lower);
  if (!name) return { keep: null }; // xmlns, class, data-*, editor attributes: they change nothing on the page.
  if (name === "href" && !value.trim().startsWith("#"))
    return { error: `The SVG has an href that points outside the SVG ("${value.slice(0, 40)}"). Only links to an id inside it (#name) are allowed.` };
  if (/url\(\s*(?!['"]?\s*#)/i.test(value))
    return { error: `The SVG has a url() that loads a file ("${value.slice(0, 40)}"). Only url(#name) for an id inside it is allowed.` };
  return { keep: name };
}

/** The viewBox from the root, or from its width and height. Null when neither gives a size. */
function viewBoxOf(attrs: Map<string, string>): number[] | null {
  const box = attrs.get("viewBox");
  if (box !== undefined) {
    const n = box.trim().split(/[\s,]+/).map(Number);
    return n.length === 4 && n.every(Number.isFinite) && n[2] > 0 && n[3] > 0 ? n : null;
  }
  const [w, h] = ["width", "height"].map((k) => Number((attrs.get(k) ?? "").trim().replace(/px$/, "")));
  return w > 0 && h > 0 ? [0, 0, w, h] : null;
}

/** Relative luminance (0 to 1) of a colour, or null for paint that is kept as it is. */
function luminance(paint: string, gradients: Map<string, number>): number | null {
  const v = paint.trim().toLowerCase();
  if (/^(none|transparent|currentcolor|inherit)$/.test(v) || /^(var|color-mix)\(/.test(v)) return null;
  const ref = /^url\(\s*['"]?#([^'")\s]+)/.exec(paint.trim());
  if (ref) return gradients.get(ref[1]) ?? 0;
  let rgb: number[] | null = null;
  const hex = /^#([0-9a-f]{3,8})$/.exec(v)?.[1];
  if (hex && [3, 4].includes(hex.length)) rgb = [...hex.slice(0, 3)].map((c) => parseInt(c + c, 16));
  else if (hex && [6, 8].includes(hex.length)) rgb = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
  else if (v.startsWith("rgb")) {
    const n = v.match(/[\d.]+%?/g) ?? [];
    rgb = n.slice(0, 3).map((x) => (x.endsWith("%") ? (parseFloat(x) * 255) / 100 : parseFloat(x)));
  } else if (v === "white") rgb = [255, 255, 255];
  if (!rgb || rgb.length < 3) return 0; // black, and any other named colour: dark
  const [r, g, b] = rgb.map((c) => {
    const x = Math.min(255, Math.max(0, c)) / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Paints the icon in the text colour. An icon with light and dark parts keeps its detail: the light parts become
 * cut-outs in the page colour, like the built-in Playwright mark. Masks are left alone: their colours are not paint.
 */
function unifyColours(root: Node) {
  const gradients = new Map<string, number>();
  const visit = (node: Node, fn: (node: Node) => void) => {
    fn(node);
    if (node.name !== "mask") node.children.forEach((c) => visit(c, fn));
  };
  visit(root, (node) => {
    const id = node.attrs.find(([k]) => k === "id")?.[1];
    if (!id || !/Gradient$/.test(node.name)) return;
    const stops = node.children.filter((c) => c.name === "stop").map((c) => luminance(c.attrs.find(([k]) => k === "stop-color")?.[1] ?? "#000", gradients) ?? 0);
    if (stops.length) gradients.set(id, stops.reduce((a, b) => a + b, 0) / stops.length);
  });

  const lums: number[] = [];
  visit(root, (node) => {
    for (const [k, v] of node.attrs) if (k === "fill" || k === "stroke") lums.push(luminance(v, gradients) ?? NaN);
  });
  const twoTone = lums.some((l) => l < LIGHT) && lums.some((l) => l >= LIGHT);
  visit(root, (node) => {
    node.attrs = node.attrs.map(([k, v]) => {
      if (k !== "fill" && k !== "stroke") return [k, v];
      const l = luminance(v, gradients);
      return [k, l === null ? v : twoTone && l >= LIGHT ? "var(--bg)" : "currentColor"];
    });
  });
}

function serialize(node: Node): string {
  const attrs = node.attrs.map(([k, v]) => ` ${k}="${escape(v)}"`).join("");
  return node.children.length
    ? `<${node.name}${attrs}>${node.children.map(serialize).join("")}</${node.name}>`
    : `<${node.name}${attrs}/>`;
}

/** Parses pasted SVG code and writes it out again with only the allowed elements and attributes. */
export function cleanSvg(input: string): SvgCheck {
  const code = input.replace(/^﻿/, "").trim();
  if (!code) return fail("Paste the SVG code of the icon. It starts with <svg.");
  if (code.length > MAX_LENGTH) return fail(`The SVG code is too long. It can be ${MAX_LENGTH / 1000} KB at most. Simplify the icon and paste it again.`);

  let root: Node | null = null;
  const stack: Node[] = [];
  let skipDepth = 0; // > 0 while inside an element that is dropped with its content
  let count = 0;
  let i = 0;

  while (i < code.length) {
    const lt = code.indexOf("<", i);
    const text = code.slice(i, lt === -1 ? code.length : lt);
    if (text.trim() && skipDepth === 0) return fail("The SVG has text outside its elements. Remove the text and paste again.");
    if (lt === -1) break;
    i = lt;

    if (code.startsWith("<![CDATA[", i)) return fail("The SVG has a CDATA section. Remove it and paste again.");
    SKIP.lastIndex = i;
    const skipped = SKIP.exec(code);
    if (skipped) {
      i += skipped[0].length;
      continue;
    }

    CLOSE.lastIndex = i;
    const close = CLOSE.exec(code);
    if (close) {
      i += close[0].length;
      if (skipDepth > 0) {
        skipDepth--;
        continue;
      }
      const open = stack.pop();
      if (!open || open.name.toLowerCase() !== close[1].toLowerCase())
        return fail(`The </${close[1]}> tag does not match ${open ? `the open <${open.name}> element` : "an open element"}. Check the SVG code.`);
      continue;
    }

    TAG.lastIndex = i;
    const tag = TAG.exec(code);
    if (!tag) return fail("The SVG code is not valid: a tag is broken. Copy the whole code again and paste it.");
    i += tag[0].length;
    const [, rawName, rawAttrs, selfClosing] = tag;
    const lower = rawName.toLowerCase();

    if (skipDepth > 0 || DROPPED.has(lower) || rawName.includes(":")) {
      if (!selfClosing) skipDepth++;
      continue;
    }
    if (!root && lower !== "svg") return fail("The code must start with an <svg> element. Paste the whole SVG code.");
    if (root && stack.length === 0) return fail("Paste one <svg> element only.");
    const name = ELEMENT_NAMES.get(lower);
    if (!name || (root && name === "svg"))
      return fail(`The SVG has a <${rawName}> element, which is not allowed. Only shapes, groups, gradients, clip paths, masks and filters are allowed. Remove it and paste again.`);
    if (++count > MAX_ELEMENTS) return fail(`The SVG has more than ${MAX_ELEMENTS} elements. Simplify the icon and paste it again.`);

    const attrs: [string, string][] = [];
    for (const [, raw, q1, q2, bare] of rawAttrs.matchAll(ATTR)) {
      const value = decode(q1 ?? q2 ?? bare ?? "");
      const check = checkAttribute(raw, value);
      if ("error" in check) return fail(check.error);
      if (check.keep && !attrs.some(([k]) => k === check.keep)) attrs.push([check.keep, value]);
    }

    const node: Node = { name, attrs, children: [] };
    if (root) stack[stack.length - 1].children.push(node);
    else root = node;
    if (!selfClosing) stack.push(node);
  }

  if (!root) return fail("The code must start with an <svg> element. Paste the whole SVG code.");
  if (stack.length > 0) return fail(`The <${stack[stack.length - 1].name}> element is not closed. Copy the whole code again and paste it.`);

  const box = viewBoxOf(new Map(root.attrs));
  if (!box) return fail("The SVG needs a viewBox (or a width and a height) with a size above zero. Add it and paste again.");
  // An SVG without a fill draws in black, which the colour pass then turns into the text colour.
  if (!root.attrs.some(([k]) => k === "fill")) root.attrs.push(["fill", "currentColor"]);
  unifyColours(root);
  const fill = root.attrs.find(([k]) => k === "fill")![1];
  // The viewBox is fitted to the drawing, so every icon fills the same square, whatever margin it came with.
  const fitted = squareBounds(root, fill) ?? box;
  const rest = root.attrs.filter(([k]) => !["viewBox", "width", "height", "x", "y", "fill", "preserveAspectRatio"].includes(k));
  root.attrs = [
    ["viewBox", fitted.join(" ")],
    ["width", String(ICON_SIZE)],
    ["height", String(ICON_SIZE)],
    ["fill", fill],
    ...rest,
    ["aria-hidden", "true"],
    ["focusable", "false"],
  ];
  return { ok: true, svg: serialize(root) };
}
