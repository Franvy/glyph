// The garden's sounds, synthesised with Web Audio: no files. Which cue plays when: src/lib/garden/sounds.ts.
// Kept quiet on purpose: the banner is a small scene, and its sounds sit under the interface cues from cuelume.
// Every cue honours the site's sound switch (<html data-sound="off">).
import type { PetCue, SkyCue } from "@/lib/garden/sounds";

type Filter = BiquadFilterType;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;

/** The shared context, or null while sound is off or before the visitor has touched the page. */
function audio(): AudioContext | null {
  if (document.documentElement.dataset.sound === "off" || typeof AudioContext === "undefined") return null;
  // Before a first gesture the browser would only make a suspended context, and log a warning for it.
  if (!ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
  if (!ctx) {
    ctx = new AudioContext();
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -16;
    limit.ratio.value = 6;
    out = ctx.createGain();
    out.gain.value = 0.55;
    out.connect(limit).connect(ctx.destination);
    // One second of white noise, shared by every noisy cue.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A gain into the output, panned. */
function voice(c: AudioContext, pan: number) {
  const gain = c.createGain();
  const panner = c.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  gain.connect(panner).connect(out!);
  return gain;
}

/** Rise to `peak` in `attack`, hold for `hold`, then fall away over `decay`. Returns the end time. */
function envelope(param: AudioParam, at: number, peak: number, attack: number, decay: number, hold = 0) {
  param.setValueAtTime(0.0001, at);
  param.linearRampToValueAtTime(peak, at + attack);
  param.setValueAtTime(peak, at + attack + hold);
  param.exponentialRampToValueAtTime(0.0001, at + attack + hold + decay);
  return at + attack + hold + decay;
}

interface Shape {
  at: number;
  pan: number;
  peak: number;
  attack: number;
  decay: number;
  hold?: number;
}

function tone(c: AudioContext, s: Shape & { type?: OscillatorType; from: number; to?: number; glide?: number }) {
  const osc = c.createOscillator();
  osc.type = s.type ?? "sine";
  osc.frequency.setValueAtTime(s.from, s.at);
  if (s.to) osc.frequency.exponentialRampToValueAtTime(s.to, s.at + (s.glide ?? s.attack + s.decay));
  const gain = voice(c, s.pan);
  osc.connect(gain);
  osc.start(s.at);
  osc.stop(envelope(gain.gain, s.at, s.peak, s.attack, s.decay, s.hold) + 0.02);
}

function hiss(c: AudioContext, s: Shape & { filter: Filter; freq: number; to?: number; q?: number }) {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = s.filter;
  filter.Q.value = s.q ?? 1;
  filter.frequency.setValueAtTime(s.freq, s.at);
  if (s.to) filter.frequency.exponentialRampToValueAtTime(s.to, s.at + s.attack + (s.hold ?? 0) + s.decay);
  const gain = voice(c, s.pan);
  src.connect(filter).connect(gain);
  src.start(s.at, Math.random() * 0.9);
  src.stop(envelope(gain.gain, s.at, s.peak, s.attack, s.decay, s.hold) + 0.02);
}

/** A heart floats up: a small rising bubble. A 红包: two bright coin strikes. */
export function petSound(cue: PetCue, pan: number) {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  if (cue === "hongbao") {
    for (const [dt, f, peak] of [[0, 1976, 0.05], [0.07, 2637, 0.045]] as const) {
      tone(c, { at: at + dt, pan, from: f, peak, attack: 0.002, decay: 0.4 });
      tone(c, { at: at + dt, pan, from: f * 1.5, peak: peak * 0.4, attack: 0.002, decay: 0.18 });
    }
    return;
  }
  tone(c, { at, pan, from: 620, to: 980, glide: 0.07, peak: 0.08, attack: 0.006, decay: 0.12 });
  tone(c, { at: at + 0.045, pan, from: 1310, peak: 0.025, attack: 0.004, decay: 0.09 });
}

/** The yarn ball rolls off: a soft thump, then bumps that space out and fade as it slows. */
export function yarnSound(pan: number) {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  tone(c, { at, pan, from: 120, to: 70, peak: 0.07, attack: 0.004, decay: 0.09 });
  let t = 0.05;
  for (let i = 0; i < 6; i++) {
    hiss(c, { at: at + t, pan, filter: "lowpass", freq: 420, peak: 0.06 * (1 - i / 7), attack: 0.006, decay: 0.05 });
    t += 0.07 + i * 0.025;
  }
}

/** The lamps come on: a two-part switch click. */
export function lampSound(pan: number) {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  hiss(c, { at, pan, filter: "bandpass", freq: 2400, q: 3, peak: 0.05, attack: 0.001, decay: 0.012 });
  hiss(c, { at: at + 0.028, pan, filter: "bandpass", freq: 1500, q: 3, peak: 0.03, attack: 0.001, decay: 0.016 });
}

/** One click in the sky. A firework's whistle lasts `rise` seconds; its burst comes from burstSound, a drop from dropSound. */
export function skySound(cue: Exclude<SkyCue, "drop">, pan: number, rise = 0) {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  switch (cue) {
    case "firework":
      tone(c, { at, pan, from: 720, to: 1900, glide: rise, peak: 0.022, attack: 0.04, hold: Math.max(0, rise - 0.04), decay: 0.05 });
      hiss(c, { at, pan, filter: "highpass", freq: 4500, peak: 0.012, attack: 0.03, hold: Math.max(0, rise - 0.03), decay: 0.06 });
      return;
    case "paper":
      hiss(c, { at, pan, filter: "bandpass", freq: 2600, q: 0.8, peak: 0.035, attack: 0.02, decay: 0.16 });
      hiss(c, { at: at + 0.09, pan, filter: "bandpass", freq: 3300, q: 0.8, peak: 0.02, attack: 0.02, decay: 0.12 });
      return;
    case "firefly": {
      const f = [1568, 1760, 2093, 2349, 2637][Math.floor(Math.random() * 5)];
      tone(c, { at, pan, from: f, peak: 0.035, attack: 0.012, decay: 0.5 });
      tone(c, { at, pan, type: "triangle", from: f * 2, peak: 0.008, attack: 0.01, decay: 0.2 });
      return;
    }
  }
}

/** A raindrop lands: the classic plip, a quick upward chirp. */
export function dropSound(pan: number) {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  const f = rand(340, 440);
  tone(c, { at, pan, from: f, to: f * 3.4, glide: 0.03, peak: 0.07, attack: 0.002, decay: 0.07 });
}

/** A firework bursts: a low boom, then a crackle of sparks across the burst. */
export function burstSound(pan: number) {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  hiss(c, { at, pan, filter: "lowpass", freq: 1100, to: 140, peak: 0.2, attack: 0.003, decay: 0.75 });
  tone(c, { at, pan, from: 95, to: 42, peak: 0.14, attack: 0.003, decay: 0.38 });
  for (let i = 0; i < 9; i++) {
    hiss(c, {
      at: at + rand(0.25, 1.1),
      pan: pan + rand(-0.2, 0.2),
      filter: "bandpass",
      freq: rand(2800, 6000),
      q: 3,
      peak: rand(0.02, 0.045),
      attack: 0.001,
      decay: 0.012,
    });
  }
}

/** One 鞭炮 cracker: a sharp crack over a short low thump. Each one a little different. */
export function popSound(pan: number) {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  const level = rand(0.75, 1);
  hiss(c, { at, pan, filter: "bandpass", freq: rand(1700, 2700), q: 0.9, peak: 0.26 * level, attack: 0.001, decay: 0.045 });
  hiss(c, { at, pan, filter: "lowpass", freq: 450, peak: 0.16 * level, attack: 0.002, decay: 0.08 });
  tone(c, { at, pan, from: 190, to: 60, peak: 0.1 * level, attack: 0.002, decay: 0.05 });
}
