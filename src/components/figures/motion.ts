// The motion of the project drawings (figures/, built into src/figures). Each drawing runs a short tour of its
// machine while it is on screen, and shows one still pose for visitors who ask for less motion.
import params from "@/figures/params.json";

type Flat = [number, number];
type Projection = { origin: number[]; scale: number; azimuth?: number; elevation?: number };
type Spring = { at: number; rate: number };

// The camera from figures/kit/iso-kit.mjs: the same projection the drawings were built with.
const RADIANS = Math.PI / 180;
function iso([x, y, z]: number[], P: Projection): Flat {
  const a = (P.azimuth ?? 45) * RADIANS;
  const e = (P.elevation ?? 30) * RADIANS;
  const k = P.scale * Math.sqrt(1.6);
  return [P.origin[0] + (x * Math.sin(a) - y * Math.cos(a)) * k, P.origin[1] + ((x * Math.cos(a) + y * Math.sin(a)) * Math.sin(e) - z * Math.cos(e)) * k];
}
const fine = (value: number) => Math.round(value * 100) / 100;
function translateAlong(P: Projection, by: number[]) {
  const [ox, oy] = iso([0, 0, 0], P);
  const [x, y] = iso(by, P);
  return `translate(${fine(x - ox)} ${fine(y - oy)})`;
}
function lineOnTop(from: Flat, to: Flat, z: number, P: Projection) {
  const [a, b] = [iso([...from, z], P), iso([...to, z], P)];
  return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
}

const follow = (value: number, target: number, dt: number, seconds: number) => value + (target - value) * (1 - Math.exp(-dt / seconds));
/** A sub-stepped spring toward `target`. */
function spring(s: Spring, target: number, dt: number, stiffness: number, damping: number) {
  for (let n = 0; n < 4; n++) {
    s.rate += ((target - s.at) * stiffness - s.rate * damping) * (dt / 4);
    s.at += s.rate * (dt / 4);
  }
}
const lit = (group: Element, on: boolean) => group.querySelectorAll(".iso-solid").forEach((solid) => solid.toggleAttribute("data-lit", on));
const parts = (svg: SVGElement, name: string) => [...svg.querySelectorAll(`[data-part="${name}"]`)];
const part = (svg: SVGElement, name: string) => svg.querySelector(`[data-part="${name}"]`)!;

type Figure = { tick(dt: number): void; still(): void };

/** Gtab: the slider picks a card, the key goes down, the card rises out of the box, holds and settles back. */
function gtab(svg: SVGElement): Figure {
  const { P, slide: SLIDE, lift: LIFT, travel: TRAVEL } = params.gtab;
  const cards = parts(svg, "card");
  const slider = part(svg, "slider");
  const keycap = part(svg, "keycap");
  const CYCLE = 3.2;
  const lift = cards.map(() => ({ at: 0, rate: 0 }));
  let clock = 0;
  let pick = 0;
  let slide = SLIDE[0];
  let press = 0;
  const draw = () => {
    slider.setAttribute("transform", translateAlong(P, [0, slide, 0]));
    keycap.setAttribute("transform", translateAlong(P, [0, 0, -press * TRAVEL]));
    cards.forEach((card, i) => {
      card.setAttribute("transform", translateAlong(P, [0, 0, lift[i].at * LIFT]));
      lit(card, i === pick && lift[i].at > 0.04);
    });
  };
  return {
    tick(dt) {
      clock += dt;
      const phase = clock % CYCLE;
      pick = Math.floor(clock / CYCLE) % cards.length;
      slide = follow(slide, SLIDE[pick], dt, 0.16);
      press = follow(press, phase > 0.7 && phase < 0.86 ? 1 : 0, dt, 0.04);
      lift.forEach((s, i) => spring(s, i === pick && phase > 0.78 && phase < 2.5 ? 1 : 0, dt, 160, 19));
      draw();
    },
    still() {
      lift[0].at = 1;
      draw();
    },
  };
}

/** limns.dev: the gantry takes the loupe to a slide; the slide lifts and lights, and keeps its pin once saved. */
function limnsDev(svg: SVGElement): Figure {
  const { P, stops: STOPS, rise: RISE } = params["limns-dev"];
  const slides: Element[] = [];
  parts(svg, "slide").forEach((el) => (slides[Number((el as SVGElement).dataset.index)] = el));
  const back = part(svg, "gantry-back");
  const gantry = part(svg, "gantry");
  const loupe = part(svg, "loupe");
  const DWELL = 2.4;
  const lift = slides.map(() => ({ at: 0, rate: 0 }));
  const saved = new Set<number>();
  let clock = 0;
  let x = STOPS[0].x;
  let y = STOPS[0].y;
  let stop = STOPS[0];
  const draw = () => {
    const t = translateAlong(P, [x, 0, 0]);
    back.setAttribute("transform", t);
    gantry.setAttribute("transform", t);
    loupe.setAttribute("transform", translateAlong(P, [0, y, 0]));
    slides.forEach((el, i) => {
      el.setAttribute("transform", translateAlong(P, [0, 0, lift[i].at * RISE]));
      el.querySelector(":scope > .iso-solid")!.toggleAttribute("data-lit", i === stop.i && lift[i].at > 0.05);
      (el.querySelector('[data-part="pin"]') as SVGElement).style.opacity = saved.has(i) ? "1" : "0";
    });
  };
  return {
    tick(dt) {
      clock += dt;
      const n = Math.floor(clock / DWELL);
      const phase = clock % DWELL;
      stop = STOPS[n % STOPS.length];
      if (n % STOPS.length === 0 && phase < dt) saved.clear();
      x = follow(x, stop.x, dt, 0.22);
      y = follow(y, stop.y, dt, 0.22);
      const arrived = Math.hypot(stop.x - x, stop.y - y) < 0.6;
      lift.forEach((s, i) => spring(s, i === stop.i && arrived && phase < DWELL - 0.5 ? 1 : 0, dt, 180, 20));
      if (arrived && lift[stop.i].at > 0.9) saved.add(stop.i);
      draw();
    },
    still() {
      lift[STOPS[0].i].at = 1;
      saved.add(STOPS[0].i).add(STOPS[3].i);
      draw();
    },
  };
}

/** limns.cc: the carriage brings a head over the paper and it stamps; the paper shows what that head makes. */
function limnsCc(svg: SVGElement): Figure {
  const { P, heads: HEADS, stroke: STROKE, knob: KNOB, angles: ANGLES, home } = params["limns-cc"];
  const carriage = part(svg, "carriage");
  const rods = parts(svg, "rod");
  const pointer = part(svg, "pointer");
  const printed = { chat: svg.querySelector('[data-print="chat"]') as SVGElement, image: svg.querySelector('[data-print="image"]') as SVGElement };
  const ORDER = [0, 2, 3, 1];
  const CYCLE = 2.8;
  const stamp = { at: 0, rate: 0 };
  let clock = 0;
  let index = home;
  let x = -HEADS[home].x;
  let angle = ANGLES[home];
  let shown = "image";
  const draw = () => {
    carriage.setAttribute("transform", translateAlong(P, [x, 0, 0]));
    pointer.setAttribute("d", lineOnTop([KNOB[0], KNOB[1]], [KNOB[0] + Math.sin(angle) * 4.6, KNOB[1] - Math.cos(angle) * 4.6], 9, P));
    rods.forEach((rod, i) => {
      rod.setAttribute("transform", i === index ? translateAlong(P, [0, 0, -stamp.at * STROKE]) : "");
      lit(rod, i === index);
    });
    printed.chat.style.opacity = shown === "chat" ? "1" : "0";
    printed.image.style.opacity = shown === "image" ? "1" : "0";
  };
  return {
    tick(dt) {
      clock += dt;
      index = ORDER[Math.floor(clock / CYCLE) % ORDER.length];
      const phase = clock % CYCLE;
      x = follow(x, -HEADS[index].x, dt, 0.2);
      angle = follow(angle, ANGLES[index], dt, 0.14);
      spring(stamp, phase > 1.1 && phase < 1.32 ? 1 : 0, dt, 420, 30);
      stamp.at = Math.min(stamp.at, 1);
      if (stamp.at > 0.95) shown = HEADS[index].kind;
      else if (phase > 0.2 && phase < 0.5) shown = "none";
      draw();
    },
    still() {
      draw();
    },
  };
}

/** Ignite: the dial turns to a stack plan, the key goes down, the crate rises with that plan's cartridges, holds and sinks. */
function ignite(svg: SVGElement): Figure {
  const { P, stacks: STACKS, lift: LIFT, travel: TRAVEL, dial: DIAL, angles: ANGLES, home } = params.ignite;
  const crate = part(svg, "crate");
  const keycap = part(svg, "keycap");
  const pointer = part(svg, "pointer");
  const carts = parts(svg, "cart") as SVGElement[];
  const CYCLE = 4;
  const rise = { at: 0, rate: 0 };
  let clock = 0;
  let pick = home;
  let angle = ANGLES[home];
  let press = 0;
  let filled = 99;
  const draw = () => {
    pointer.setAttribute("d", lineOnTop([DIAL[0], DIAL[1]], [DIAL[0] + Math.sin(angle) * 6.6, DIAL[1] - Math.cos(angle) * 6.6], 11, P));
    keycap.setAttribute("transform", translateAlong(P, [0, 0, -press * TRAVEL]));
    crate.setAttribute("transform", translateAlong(P, [0, 0, rise.at * LIFT]));
    lit(crate, rise.at > 0.04);
    // Cartridges drop in one after another, in socket order: plugins, then the skill, then the hook.
    let order = 0;
    for (const cart of carts) {
      const kind = cart.dataset.kind as "plugins" | "skills" | "hooks";
      const used = Number(cart.dataset.index) < STACKS[pick][kind];
      cart.style.opacity = used && order++ < filled ? "1" : "0";
    }
  };
  return {
    tick(dt) {
      clock += dt;
      pick = Math.floor(clock / CYCLE) % STACKS.length;
      const phase = clock % CYCLE;
      angle = follow(angle, ANGLES[pick], dt, 0.16);
      press = follow(press, phase > 0.9 && phase < 1.06 ? 1 : 0, dt, 0.04);
      spring(rise, phase > 1 && phase < 3.3 ? 1 : 0, dt, 120, 17);
      filled = phase < 1.3 ? 0 : Math.floor((phase - 1.3) / 0.09) + 1;
      draw();
    },
    still() {
      rise.at = 1;
      draw();
    },
  };
}

const MAKERS: Record<string, (svg: SVGElement) => Figure> = { gtab, ignite, "limns-dev": limnsDev, "limns-cc": limnsCc };

/** Starts every drawing on the page that has not started yet. */
export function startFigures() {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  for (const host of document.querySelectorAll<HTMLElement>("[data-figure]:not([data-started])")) {
    const svg = host.querySelector("svg");
    const make = MAKERS[host.dataset.figure ?? ""];
    if (!svg || !make) continue;
    host.dataset.started = "";
    const figure = make(svg);
    figure.still();
    let frame = 0;
    let last = 0;
    let visible = false;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      figure.tick(dt);
      frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
    };
    const run = () => {
      if (frame || !visible || still.matches) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      run();
    }).observe(host);
    still.addEventListener("change", run);
  }
}
