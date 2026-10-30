// The footer cat's behaviour: one cat, one yarn ball, now and then a fish.
// Plain DOM (appendChild: the Workers types shadow Element.append), one requestAnimationFrame loop that runs only while the footer is on screen.
// Art and ball physics: src/lib/meiqiu.ts.
import { BALL_R, POSES, PX, ballResting, spriteSvg, stepBall, type Ball, type Pose, type PoseName } from "@/lib/meiqiu";

export type MeiqiuParts = {
  area: HTMLElement; // where the pointer counts: the whole footer column
  stage: HTMLElement;
  onPet: () => void; // once per stroke
};

type Point = { x: number; y: number }; // y: height above the ground
type Mode =
  | "sleep" | "twitch" | "wake" | "idle" | "move" | "skid" | "crouch" | "landed" | "pet"
  | "angry" | "flee" | "sulk" | "toFish" | "eat" | "full" | "nap" | "lie" | "jump" | "pat"
  | "eye" | "chase" | "swat" | "bonk" | "carry";

const cache = new Map<PoseName, ReturnType<typeof spriteSvg>>();
const art = (name: PoseName) => {
  let s = cache.get(name);
  if (!s) cache.set(name, (s = spriteSvg(POSES[name].frames)));
  return s;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const snap = (v: number) => Math.round(v / PX) * PX;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = "") {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Draw a pose into a sprite element. Returns its size in screen pixels. */
function paint(spr: HTMLElement, name: PoseName) {
  const s = art(name);
  if (spr.dataset.pose !== name) {
    const pose: Pose = POSES[name];
    spr.innerHTML = s.html;
    spr.style.setProperty("--w", `${s.w * PX}px`);
    spr.style.setProperty("--h", `${s.h * PX}px`);
    spr.style.setProperty("--n", String(s.n));
    spr.style.setProperty("--dur", `${pose.dur ?? 0.4}s`);
    spr.dataset.n = String(s.n);
    spr.dataset.pose = name;
  }
  return { w: s.w * PX, h: s.h * PX };
}

/** Start the cat. Returns a function that stops it and removes everything it added. */
export function mountMeiqiu(parts: MeiqiuParts): () => void {
  const { area, stage } = parts;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = matchMedia("(hover: none)").matches;
  const ac = new AbortController();
  const on = <T extends Event>(target: EventTarget, type: string, fn: (e: T) => void) =>
    target.addEventListener(type, fn as EventListener, { signal: ac.signal });
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const added: Element[] = [];
  const add = <E extends Element>(node: E) => {
    stage.appendChild(node);
    added.push(node);
    return node;
  };

  let W = stage.clientWidth;
  let H = stage.clientHeight;
  const resize = new ResizeObserver(() => {
    W = stage.clientWidth;
    H = stage.clientHeight;
  });
  resize.observe(stage);
  stage.querySelector<HTMLElement>("[data-ssr]")?.setAttribute("hidden", "");

  // What the cat is doing is not shown; the stage keeps it for tests and for curious readers of the DOM.
  const verb = (text: string) => {
    if (stage.dataset.doing !== text) stage.dataset.doing = text;
  };

  // ---------- things that pop out ----------
  const pop = (node: HTMLElement, x: number, y: number, life: number, rise: number) => {
    node.setAttribute("aria-hidden", "true");
    node.style.left = `${snap(x)}px`;
    node.style.bottom = `${snap(y)}px`;
    node.style.setProperty("--life", `${life}s`);
    node.style.setProperty("--rise", `${rise}px`);
    stage.appendChild(node);
    later(() => node.remove(), life * 1000 + 50);
  };
  const say = (text: string, x: number, y: number, { loud = false, life = 1, rise = -18 } = {}) =>
    pop(make("span", loud ? "mq-bubble mq-loud" : "mq-bubble", text), x, y, life, rise);
  const heart = (x: number, y: number) => {
    const node = make("span", "mq-bubble");
    const spr = make("span", "mq-spr");
    paint(spr, "heart");
    node.appendChild(spr);
    pop(node, x, y, 1.2, -22);
  };
  const dust = (x: number, dir = 0) => {
    if (reduce) return;
    for (let i = 0; i < 3; i++) {
      const d = make("span", "mq-dust");
      d.setAttribute("aria-hidden", "true");
      d.style.left = `${snap(x + rand(-6, 6))}px`;
      d.style.setProperty("--dx", `${(dir || i - 1) * rand(6, 14)}px`);
      stage.appendChild(d);
      later(() => d.remove(), 420);
    }
  };
  const thud = () => {
    if (reduce) return;
    stage.classList.remove("mq-thud");
    void stage.offsetWidth;
    stage.classList.add("mq-thud");
  };
  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: r.bottom - e.clientY };
  };

  // ---------- the cat ----------
  const catEl = add(make("button", "mq-cat"));
  catEl.type = "button";
  catEl.setAttribute("aria-label", touch ? "Meiqiu. Tap to make it jump" : "Meiqiu. Press Enter to pet it, the arrow keys to walk it, F to drop a fish");
  const catBody = make("span", "mq-body");
  const catSpr = make("span", "mq-spr");
  catBody.appendChild(catSpr);
  catEl.appendChild(catBody);
  const cat = { x: 60, y: 0, w: 60, h: 27, face: "left" as "left" | "right", pose: "sleep" as PoseName, drawn: "sleep" as PoseName };
  // Moving poses are drawn in profile. Between a front pose and a profile one the cat first
  // glances that way for a moment, so it turns round instead of swapping drawings.
  const PROFILE = new Set<PoseName>(["walk", "run", "skid", "crouch", "pounce"]);
  // Walking and running step by distance, not by time, so the paws never slide.
  const STRIDE: Partial<Record<PoseName, number>> = { walk: 5, run: 14 };
  const clock = () => performance.now() / 1000;
  let turnUntil = 0;
  let odometer = 0;
  let lastX = cat.x;
  const pose = (name: PoseName, face = cat.face) => {
    if (PROFILE.has(name) !== PROFILE.has(cat.pose) && !reduce) turnUntil = clock() + 0.12;
    cat.pose = name; // the behaviour sees the pose it asked for
    const drawn = clock() < turnUntil ? "sitL" : name;
    const size = paint(catSpr, drawn);
    if (STRIDE[drawn]) catSpr.dataset.n = "1"; // stepped by hand in renderCat
    cat.drawn = drawn;
    cat.w = size.w;
    cat.h = size.h;
    cat.face = face;
    const native = POSES[drawn].face;
    const flip = native === "front" ? face === "left" : native !== face;
    catBody.style.scale = flip ? "-1 1" : "";
  };
  const top = (dy = 6) => cat.y + cat.h + dy;
  const onCat = (p: Point, pad = 6) =>
    Math.abs(p.x - cat.x) < cat.w / 2 + pad && p.y > cat.y - pad && p.y < cat.y + cat.h + pad;
  const renderCat = () => {
    cat.x = clamp(cat.x, cat.w / 2, W - cat.w / 2);
    odometer += Math.abs(cat.x - lastX);
    lastX = cat.x;
    const stride = STRIDE[cat.drawn];
    const strip = catSpr.firstElementChild as SVGElement | null;
    if (stride && strip) {
      const n = POSES[cat.drawn].frames.length;
      strip.style.translate = `${reduce ? 0 : -(Math.floor(odometer / stride) % n) * (100 / n)}% 0`;
    } else if (strip) strip.style.translate = "";
    catEl.style.translate = `${snap(cat.x - cat.w / 2)}px ${-snap(cat.y)}px`;
  };

  // ---------- the yarn ball ----------
  const ballEl = add(make("button", "mq-prop mq-ball"));
  ballEl.type = "button";
  ballEl.setAttribute("aria-label", "Yarn ball. Press Enter to throw it to Meiqiu");
  const ballSpr = make("span", "mq-spr");
  paint(ballSpr, "ball");
  ballSpr.dataset.n = "1"; // frames follow the roll, not the clock
  ballEl.appendChild(ballSpr);
  const NS = "http://www.w3.org/2000/svg";
  const thread = add(document.createElementNS(NS, "svg"));
  thread.setAttribute("class", "mq-thread");
  thread.setAttribute("aria-hidden", "true");
  const threadPath = document.createElementNS(NS, "path");
  thread.appendChild(threadPath);
  const trail: [number, number][] = [];
  const ball: Ball = { x: Math.max(160, W - 48), y: 0, vx: 0, vy: 0, angle: 0 };
  let held = false;
  let carried = false;
  let restAt = 0;
  let energy = 0; // 1 after you throw; every swat of the cat spends some
  let lastThrow = -9;

  // ---------- the fish ----------
  let fish: { el: HTMLElement; spr: HTMLElement; x: number; y: number; vy: number; landed: boolean; eaten: boolean } | null = null;

  // ---------- state ----------
  const P = { in: false, x: 0, y: 0, lastMove: -9, lastT: 0, speed: 0, fastAt: 0, overDir: 0, overX: 0, keyPet: -9, target: null as number | null };
  let mode: Mode = "sleep";
  let since = 0;
  let now = 0;
  let lastInput = -9;
  let fishCount = 0, combo = 0;
  let strokes = 0, petSession = 0, lastPurr = 0, lastZ = 0, twitchedAt = -9, lastPat = -9;
  let lastDir = 0, skidNext: Mode = "move", swatCd = 0, besideBall = false;
  let fleeTo = 0; // chosen once: picked again each frame, it flips at the middle and the cat turns on the spot
  let clicks: number[] = [];
  let fishTimes: number[] = [];
  let jump: { x0: number; x1: number; peak: number; dur: number; t: number; after: Mode; reach: boolean } | null = null;

  const set = (m: Mode) => {
    if (mode !== m) {
      mode = m;
      since = now;
    }
  };
  const t = () => now - since;
  const poke = () => (lastInput = now);
  const asleep = () => mode === "sleep" || mode === "twitch" || mode === "lie" || mode === "nap";

  function wake(reason = "!") {
    if (!asleep()) return;
    say(reason, cat.x - 12, top(), { loud: true });
    set(mode === "lie" ? "idle" : "wake");
  }
  function leap(toX: number, peak: number, dur: number, name: PoseName, after: Mode, reach = false) {
    jump = { x0: cat.x, x1: toX, peak, dur, t: 0, after, reach };
    pose(name, toX === cat.x ? cat.face : toX > cat.x ? "right" : "left");
    set("jump");
  }
  function setCombo(n: number) {
    if (n === 0 && combo >= 2) say(`combo over ×${combo}`, ball.x, ball.y + 26);
    combo = n;
  }
  function throwBall(vx: number, vy: number) {
    ball.vx = vx;
    ball.vy = vy;
    held = false;
    carried = false;
    restAt = 0;
  }
  function userThrow(vx: number, vy: number) {
    throwBall(vx, vy);
    energy = 1;
    lastThrow = now;
    poke();
  }
  // the cat plays only with a ball you threw, never a ball it nudged itself
  const ballCalls = () => held || (energy > 0.25 && now - lastThrow < 8 && !(restAt && now - restAt > 1.2));

  function dropFish(x: number) {
    if (fish) return;
    const el = add(make("span", "mq-prop"));
    el.setAttribute("aria-hidden", "true");
    const spr = make("span", "mq-spr");
    paint(spr, "fish");
    el.appendChild(spr);
    fish = { el, spr, x: clamp(x, 20, W - 20), y: H - 16, vy: 0, landed: false, eaten: false };
    P.target = null; // the first tap of a double tap is not a walk order
    poke();
  }
  function finishFish() {
    const f = fish;
    if (!f) return;
    f.eaten = true;
    f.el.style.transition = "opacity .8s steps(4)";
    later(() => (f.el.style.opacity = "0"), 1200);
    later(() => {
      f.el.remove();
      if (fish === f) fish = null;
    }, 2100);
  }

  // ---------- input: the pointer ----------
  let tapAt = -9, tapX = 0, downOnCat = false, drag: { samples: { x: number; y: number; t: number }[]; moved: number; start: Point } | null = null;

  on<PointerEvent>(area, "pointermove", (e) => {
    const p = local(e);
    const dt = Math.max(0.008, (e.timeStamp - (P.lastT || e.timeStamp - 16)) / 1000);
    P.speed = P.speed * 0.6 + (Math.abs(p.x - P.x) / dt) * 0.4;
    if (P.speed > 1300) P.fastAt = now;
    // petting: count left-right turns of the pointer while it is on the cat
    if (onCat(p) && (e.pointerType === "mouse" || downOnCat)) {
      const dir = Math.sign(p.x - P.x);
      if (dir && P.overDir && dir !== P.overDir && Math.abs(p.x - P.overX) > 6) {
        strokes++;
        P.overX = p.x;
      }
      if (dir) P.overDir = dir;
    } else P.overDir = 0;
    Object.assign(P, { x: p.x, y: p.y, lastT: e.timeStamp, lastMove: now });
    if (e.pointerType === "mouse") P.in = true;
    poke();
  });
  on<PointerEvent>(area, "pointerleave", (e) => {
    if (e.pointerType === "mouse") P.in = false;
  });
  on<PointerEvent>(stage, "pointerdown", (e) => {
    if (e.target instanceof Node && ballEl.contains(e.target)) return;
    const p = local(e);
    downOnCat = onCat(p);
    poke();
    if (e.pointerType === "mouse" || downOnCat) return;
    Object.assign(P, { x: p.x, y: p.y, lastMove: now });
    // touch: one tap walks the cat over, a double tap drops a fish
    if (now - tapAt < 0.35 && Math.abs(p.x - tapX) < 30) dropFish(p.x);
    else {
      P.in = true;
      P.target = p.x;
      wake();
    }
    tapAt = now;
    tapX = p.x;
  });
  on(window, "pointerup", () => (downOnCat = false));
  on<MouseEvent>(stage, "dblclick", (e) => {
    const p = local(e);
    if (!onCat(p) && !(e.target instanceof Node && ballEl.contains(e.target))) dropFish(p.x);
  });

  on<MouseEvent>(catEl, "click", () => {
    poke();
    if (asleep()) return wake();
    if (["angry", "flee", "sulk", "jump", "eat", "full", "carry"].includes(mode)) return;
    clicks = clicks.filter((c) => now - c < 1.2).concat(now);
    if (clicks.length >= 3) {
      clicks = [];
      say("hah!", cat.x, top(), { loud: true });
      catEl.classList.add("mq-shake");
      pose("angry");
      set("angry");
      return;
    }
    heart(cat.x, top(2));
    leap(cat.x, 14, 0.36, "sitU", "idle");
  });
  on<KeyboardEvent>(catEl, "keydown", (e) => {
    poke();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      wake();
      P.target = clamp(cat.x + (e.key === "ArrowLeft" ? -80 : 80), 0, W);
    } else if (e.key === "f" || e.key === "F") {
      // keep the key from the page-wide command prompt
      e.preventDefault();
      e.stopPropagation();
      dropFish(cat.x + (cat.face === "left" ? -80 : 80));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (asleep()) return wake();
      strokes += 2;
      P.keyPet = now;
    }
  });

  // ---------- input: the ball ----------
  on<PointerEvent>(ballEl, "pointerdown", (e) => {
    e.preventDefault();
    ballEl.setPointerCapture(e.pointerId);
    const p = local(e);
    drag = { samples: [{ x: p.x, y: p.y, t: e.timeStamp }], moved: 0, start: p };
    held = true;
    carried = false;
    poke();
    if (asleep()) {
      say("!", cat.x, top(), { loud: true });
      set("eye");
    }
  });
  on<PointerEvent>(ballEl, "pointermove", (e) => {
    if (!drag) return;
    const p = local(e);
    drag.samples = drag.samples.filter((s) => e.timeStamp - s.t < 90).concat({ x: p.x, y: p.y, t: e.timeStamp });
    drag.moved = Math.max(drag.moved, Math.hypot(p.x - drag.start.x, p.y - drag.start.y));
    ball.x = clamp(p.x, BALL_R, W - BALL_R);
    ball.y = clamp(p.y - BALL_R, 0, H - 2 * BALL_R);
    ball.vx = ball.vy = 0;
  });
  const release = () => {
    if (!drag) return;
    const s = drag.samples;
    const a = s[0];
    const b = s[s.length - 1];
    const dt = Math.max(0.016, (b.t - a.t) / 1000);
    if (drag.moved < 6) userThrow(rand(-160, 160), 520); // a tap: toss it up a little
    else userThrow(clamp((b.x - a.x) / dt, -1800, 1800), clamp((b.y - a.y) / dt, -1800, 1800));
    drag = null;
  };
  on(ballEl, "pointerup", release);
  on(ballEl, "pointercancel", release);
  on<KeyboardEvent>(ballEl, "keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    userThrow(Math.sign(cat.x - ball.x || 1) * rand(250, 420), rand(650, 800));
  });

  // ---------- behaviour ----------
  // sit and look at x: up when it is overhead, otherwise turn toward it (the art glances left)
  const look = (x: number) => (Math.abs(x - cat.x) < 34 ? pose("sitU") : pose("sitL", x < cat.x ? "left" : "right"));
  const goal = () => P.target ?? (P.in ? P.x : null);
  // a quick flick that stops dead, not too far away: prey
  function hunting() {
    if (!P.in || !P.fastAt || now - P.fastAt > 0.6 || now - P.lastMove < 0.18) return false;
    const d = Math.abs(P.x - cat.x);
    if (d < 50 || d > 320) return false;
    P.fastAt = 0;
    return true;
  }
  /** Step toward `to`. Returns how far is left, or null when the cat skids into a turn instead. */
  // Ease into a walk or a run and out of it again, instead of starting and stopping dead.
  let speed = 0;
  function glide(to: number, top: number, dt: number) {
    const d = to - cat.x;
    const want = reduce ? 1e5 : Math.min(top, Math.abs(d) * 4 + 30);
    speed += (want - speed) * Math.min(1, dt * 5);
    cat.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    return d;
  }
  /** Step toward `to`. Returns how far is left, or null when the cat skids into a turn instead. */
  function walk(to: number, top: number, dt: number, next: Mode): number | null {
    const dir = Math.sign(to - cat.x);
    if (cat.pose === "run" && lastDir && dir && dir !== lastDir && !reduce) {
      skidNext = next;
      dust(cat.x, lastDir);
      set("skid");
      return null;
    }
    if (dir) lastDir = dir;
    return glide(to, top, dt);
  }

  function physics(dt: number) {
    if (fish && !fish.landed) {
      fish.vy -= 900 * dt;
      fish.y += fish.vy * dt;
      if (fish.y <= 0) {
        fish.y = 0;
        if (fish.vy < -160) {
          fish.vy *= -0.3;
          dust(fish.x);
        } else fish.landed = true;
      }
    }
    if (held || carried) return;
    const hit = stepBall(ball, dt, W, H);
    if (hit.wall) {
      say("thud", ball.x < W / 2 ? 14 : W - 14, ball.y + 10, { loud: true });
      thud();
    }
    if ((hit.ground ?? 0) > 500) dust(ball.x);
    // the ball lands on the cat's head
    const head = cat.y + cat.h;
    if (ball.vy < -100 && Math.abs(ball.x - cat.x) < cat.w / 2 - 4 && ball.y < head && ball.y > head - 10 && !["swat", "jump", "carry"].includes(mode)) {
      ball.y = head;
      ball.vy = 380;
      ball.vx += (ball.x > cat.x ? 1 : -1) * 120;
      say("!?", cat.x, top(8), { loud: true });
      set("bonk");
    }
    if (ballResting(ball)) restAt ||= now;
    else restAt = 0;
    if (restAt && now - restAt > 1.2 && combo) setCombo(0);
  }

  function step(dt: number) {
    physics(dt);
    swatCd -= dt;
    const g = goal();
    const pointerOnCat = P.in && onCat(P) && now - P.lastMove < 0.5;
    const petting = (pointerOnCat && strokes > 0) || now - P.keyPet < 0.8;
    const bx = ball.x - cat.x;
    const abx = Math.abs(bx);
    const fishReady = !!fish && fish.landed && !fish.eaten;
    const idleFor = now - lastInput;

    switch (mode) {
      case "sleep":
        pose("sleep");
        verb(besideBall ? "asleep with the ball" : "sleeping");
        if (now - lastZ > 1.6) {
          lastZ = now;
          say(Math.random() < 0.5 ? "z" : "Z", cat.x + (cat.face === "left" ? 18 : -18), top(-4), { life: 1.6, rise: -20 });
        }
        if (fishReady) wake("…fish?");
        else if (ballCalls()) {
          say("!", cat.x, top(), { loud: true });
          set("eye");
        } else if (P.in && Math.abs(P.x - cat.x) < 90 && now - P.lastMove < 0.3) {
          if (now - twitchedAt > 4) {
            twitchedAt = now;
            set("twitch");
          } else if (now - twitchedAt > 1) wake();
        }
        break;
      case "twitch":
        pose("twitch");
        verb("ear twitch");
        if (t() > 0.7) set("sleep");
        break;
      case "wake":
        pose(t() < 1.1 ? "stretch" : "yawn", "right");
        verb(t() < 1.1 ? "stretching" : "yawning");
        if (t() > 2.2) set("idle");
        break;

      case "idle":
        besideBall = false;
        if (fishReady) set("toFish");
        else if (ballCalls()) set(held ? "eye" : "chase");
        else if (petting) {
          petSession = 0;
          set("pet");
        } else if (hunting()) set("crouch");
        else if (g != null && Math.abs(g - cat.x) > (P.target != null ? 4 : 30) && !pointerOnCat) set("move");
        else if (idleFor > 22) set("nap");
        else if (!P.in && idleFor > 4 && restAt && abx < 70 && now - lastPat > 6) set("pat");
        else {
          P.target = null;
          if (idleFor > 6 && idleFor < 7.2) {
            pose("yawn");
            verb("yawning");
          } else if (idleFor > 9 && idleFor < 12) {
            pose("lick");
            verb("grooming");
          } else {
            if (P.in) look(P.x);
            else if (abx < 160) look(ball.x);
            else pose("sit");
            verb(P.in ? "watching you" : "zoning out");
          }
        }
        break;
      case "move": {
        if (fishReady) { set("toFish"); break; }
        if (ballCalls()) { set("chase"); break; }
        if (g == null) { set("idle"); break; }
        if (petting) { set("pet"); break; }
        if (hunting()) { set("crouch"); break; }
        const far = Math.abs(g - cat.x);
        const run = far > 150 || (cat.pose === "run" && far > 40);
        const d = walk(g, run ? 190 : 75, dt, "move");
        if (d === null) break;
        pose(run ? "run" : "walk", d > 0 ? "right" : d < 0 ? "left" : cat.face);
        verb(run ? "running over" : "walking over");
        if (Math.abs(d) < 3) {
          P.target = null;
          lastDir = 0;
          set("idle");
        }
        break;
      }
      case "skid":
        pose("skid", lastDir > 0 ? "right" : "left");
        verb("skidding");
        cat.x += lastDir * 60 * dt * Math.max(0, 1 - t() / 0.3);
        if (t() > 0.3) {
          lastDir = 0;
          speed = 0;
          set(skidNext);
        }
        break;

      case "crouch":
        pose("crouch", P.x > cat.x ? "right" : "left");
        verb("wiggling, about to pounce");
        if (t() > 0.75) {
          leap(clamp(P.x, 24, W - 24), 30, 0.5, "pounce", "landed");
          verb("pounce!");
        }
        break;
      case "landed": {
        const got = P.in && Math.abs(P.x - cat.x) < 26;
        say(got ? "got it!" : "?", cat.x, top(), { loud: got });
        dust(cat.x);
        if (got) pose("sitU");
        else look(P.x);
        set("idle");
        break;
      }

      case "pet":
        if (strokes > 0) {
          if (now - lastPurr > 0.7) {
            lastPurr = now;
            say("prr", cat.x + 26, top(-10));
          }
          for (; strokes > 0; strokes--) {
            petSession++;
            parts.onPet();
            if (petSession % 5 === 0) heart(cat.x + rand(-8, 8), top(2));
          }
        }
        pose("purr");
        verb("purring");
        if (petSession > 28) {
          // too much: cats get overstimulated
          petSession = 0;
          say("enough!", cat.x, top(), { loud: true });
          catEl.classList.add("mq-shake");
          pose("angry");
          set("angry");
        } else if ((!pointerOnCat || now - P.lastMove > 0.6) && now - P.keyPet > 0.8) set("idle");
        break;

      case "angry":
        verb("puffed up");
        if (t() > 0.9) {
          catEl.classList.remove("mq-shake");
          P.target = null;
          fleeTo = cat.x < W / 2 ? W - 30 : 30;
          set("flee");
        }
        break;
      case "flee": {
        const d = glide(clamp(fleeTo, 30, W - 30), 230, dt); // the stage can shrink on the way
        pose("run", d > 0 ? "right" : "left");
        verb("running away");
        if (Math.abs(d) < 3) set("sulk");
        break;
      }
      case "sulk":
        // its back to you, facing the wall
        pose("lie", cat.x > W / 2 ? "right" : "left");
        verb("sulking");
        if (t() > 0.4 && t() - dt <= 0.4) say("hmph", cat.x, top());
        if (fishReady) {
          say("…fine", cat.x, top());
          set("toFish");
        } else if (t() > 5) set("idle");
        break;

      case "toFish": {
        if (!fish) { set("idle"); break; }
        if (fishTimes.filter((x) => now - x < 40).length >= 3) {
          say("too full", cat.x, top());
          finishFish();
          set("full");
          break;
        }
        const stand = fish.x + (fish.x > cat.x ? -30 : 30);
        const d = glide(stand, 200, dt);
        pose("run", d > 0 ? "right" : "left");
        verb("fish!");
        if (Math.abs(d) < 3) {
          pose("eat", fish.x > cat.x ? "right" : "left");
          set("eat");
        }
        break;
      }
      case "eat":
        verb("eating a fish");
        if (Math.floor(t() / 0.5) !== Math.floor((t() - dt) / 0.5)) say("nom", cat.x + (cat.face === "right" ? 20 : -20), top(-6), { life: 0.8 });
        if (t() > 1.6 && fish) {
          paint(fish.spr, "bones");
          finishFish();
          stage.dataset.fish = String(++fishCount);
          fishTimes.push(now);
          heart(cat.x, top(2));
          set(fishTimes.filter((x) => now - x < 40).length >= 3 ? "full" : "idle");
        }
        break;
      case "full":
        pose("belly", "left");
        verb("stuffed, belly up");
        if (Math.floor(t() / 1.8) !== Math.floor((t() - dt) / 1.8)) say("hic", cat.x - 20, top(-6));
        if (t() > 6) {
          fishTimes = [];
          set("lie");
        }
        break;

      case "nap": {
        // go and lie down by the ball
        const stand = ball.x + (ball.x > cat.x ? -44 : 44);
        const d = stand - cat.x;
        if (Math.abs(d) > 3 && W > 0) {
          glide(stand, 60, dt);
          pose("walk", d > 0 ? "right" : "left");
          verb("walking to the ball");
          if (ballCalls() || (P.in && now - P.lastMove < 0.2)) set("idle");
        } else {
          besideBall = true;
          set("lie");
        }
        break;
      }
      case "lie":
        pose("lie", besideBall ? (bx > 0 ? "right" : "left") : "left");
        verb(besideBall ? "lying by the ball" : "lying down");
        if (P.in && now - P.lastMove < 0.2 && Math.abs(P.x - cat.x) < 120) set("idle");
        else if (fishReady || ballCalls()) set("idle");
        else if (t() > 8) set("sleep");
        break;

      case "pat": {
        // nudge the still ball, gently, so it does not start a game
        const stand = ball.x + (ball.x > cat.x ? -16 : 16);
        const d = stand - cat.x;
        if (Math.abs(d) > 3 && t() < 3) {
          glide(stand, 70, dt);
          pose("walk", d > 0 ? "right" : "left");
          verb("going to the ball");
        } else {
          pose("swat", bx > 0 ? "right" : "left");
          verb("patting the yarn ball");
          if (restAt) throwBall(Math.sign(bx || 1) * rand(90, 150), 0);
          lastPat = now;
          set("swat");
        }
        break;
      }

      case "eye": {
        // you are holding the ball: stare, and get ready
        if (!held) { set("chase"); break; }
        const low = ball.y < 50 && abx < 220;
        if (low) pose("crouch", bx > 0 ? "right" : "left");
        else look(ball.x);
        verb(low ? "wiggling" : "eyeing the yarn ball");
        break;
      }
      case "chase": {
        if (held) { set("eye"); break; }
        // high overhead and coming down: stand up and catch it
        if (abx < 34 && ball.y > 34 && ball.y < 90 && ball.vy < 0) {
          leap(cat.x, 18, 0.42, "reach", "chase", true);
          pose("reach", bx > 0 ? "right" : "left");
          verb("jumping to catch");
          break;
        }
        // in reach: swat it back toward the middle
        if (abx < 26 && ball.y < 30 && swatCd <= 0 && energy > 0.25) {
          const toMid = Math.sign(W / 2 - ball.x) || 1;
          const dir = Math.abs(W / 2 - ball.x) > W * 0.3 ? toMid : Math.sign(bx) || toMid;
          pose("swat", bx > 0 ? "right" : "left");
          throwBall(dir * rand(380, 700) * energy, rand(420, 680) * Math.sqrt(energy));
          energy *= 0.8;
          setCombo(combo + 1);
          if (combo >= 3) say(`×${combo}`, cat.x, top(), { loud: true });
          swatCd = 0.5;
          verb("swat!");
          set("swat");
          break;
        }
        if (!ballCalls()) {
          set("idle");
          break;
        }
        const run = abx > 90;
        const stop = 12;
        const d = walk(ball.x - Math.sign(bx) * stop, run ? 210 : 90, dt, "chase");
        if (d === null) break;
        pose(run ? "run" : "walk", d > 0 ? "right" : d < 0 ? "left" : cat.face);
        verb(run ? "chase!" : "going over");
        break;
      }
      case "swat":
        if (t() > 0.3) set(ballCalls() ? "chase" : "idle");
        break;
      case "bonk":
        pose("shock");
        verb("hit on the head");
        if (t() > 0.6) set(ballCalls() ? "chase" : "idle");
        break;
      case "carry":
        pose("sit");
        verb("proud, ball in mouth");
        // held at its cheek, on the side it faces
        ball.x = cat.x + (cat.face === "left" ? -1 : 1) * (cat.w / 2 - 6);
        ball.y = 6;
        if (t() > 1.3) {
          pose("swat");
          const to = P.in ? P.x : W / 2;
          throwBall((Math.sign(to - cat.x) || 1) * rand(420, 620), rand(560, 720));
          energy = Math.max(energy, 0.6);
          lastThrow = now;
          verb("tossing it to you");
          set("swat");
        }
        break;

      case "jump": {
        if (!jump) { set("idle"); break; }
        jump.t += dt;
        const k = reduce ? 1 : clamp(jump.t / jump.dur, 0, 1);
        cat.x = jump.x0 + (jump.x1 - jump.x0) * k;
        cat.y = 4 * jump.peak * k * (1 - k);
        if (jump.reach && !carried) {
          const mouth = cat.x + (cat.face === "right" ? 10 : -10);
          if (Math.abs(ball.x - mouth) < 22 && Math.abs(ball.y - (cat.y + cat.h - 8)) < 22) {
            carried = true;
            ball.vx = ball.vy = 0;
            setCombo(combo + 1);
            say("caught it!", cat.x, top(10), { loud: true });
          }
        }
        if (k >= 1) {
          cat.y = 0;
          const next = jump.reach && carried ? "carry" : jump.after;
          jump = null;
          set(next);
        }
        break;
      }
    }
    renderCat();
    renderBall();
    if (fish) fish.el.style.translate = `${snap(fish.x - 13)}px ${-snap(fish.y)}px`;
  }

  function renderBall() {
    const frame = carried ? 0 : ((Math.floor(ball.angle / (Math.PI / 4)) % 4) + 4) % 4;
    const strip = ballSpr.firstElementChild as SVGElement | null;
    if (strip) strip.style.translate = `${-frame * 25}% 0`;
    ballEl.style.translate = `${snap(ball.x - BALL_R)}px ${-snap(ball.y)}px`;
    if (reduce) return;
    // the thread: the last stretch of the ball's path
    trail.push([snap(ball.x), snap(H - ball.y - BALL_R)]);
    if (trail.length > 26) trail.shift();
    threadPath.setAttribute("d", `M${trail.map((p) => p.join(" ")).join("L")}`);
  }

  // ---------- the loop: only while the footer is on screen ----------
  let raf = 0;
  let last = 0;
  const tick = (ms: number) => {
    // cap the step so a stalled tab does not teleport the cat, but keep slow devices at real speed
    const dt = Math.min(0.1, (ms - (last || ms)) / 1000);
    last = ms;
    now = ms / 1000;
    step(dt);
    raf = requestAnimationFrame(tick);
  };
  const seen = new IntersectionObserver(([entry]) => {
    cancelAnimationFrame(raf);
    if (entry.isIntersecting) {
      last = 0;
      raf = requestAnimationFrame(tick);
    }
  });
  seen.observe(stage);
  pose("sleep");
  renderCat();
  renderBall();

  return () => {
    ac.abort();
    cancelAnimationFrame(raf);
    seen.disconnect();
    resize.disconnect();
    for (const id of timers) window.clearTimeout(id);
    for (const node of added) node.remove();
    stage.querySelector("[data-ssr]")?.removeAttribute("hidden");
    delete stage.dataset.doing;
    delete stage.dataset.fish;
  };
}
