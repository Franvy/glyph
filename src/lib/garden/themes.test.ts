import { describe, expect, it } from "vitest";
import { PALETTES, type Key } from "./palette";
import { layout, paintStatic } from "./scene";
import { burst, nextScene, type SceneName, SCENES, sceneSpots, shelter, weather } from "./themes";

const l = layout(222, 74);
const G = l.ground;
const peak = l.house.x + 19;
const at = (keys: (Key | null)[], x: number, y: number) => keys[y * l.w + x];
const CLOUD = new Set<Key | null>(["cloud", "cloudLit", "cloudBelly", "deck", "deckLit", "deckBelly"]);

describe("garden themes", () => {
  it("cycles through all seven themes and back", () => {
    expect(SCENES).toEqual(["clear", "cloudy", "rain", "storm", "snow", "fog", "spring"]);
    let s: SceneName = SCENES[0];
    const seen = [];
    for (let i = 0; i < SCENES.length; i++) {
      seen.push(s);
      s = nextScene(s);
    }
    expect(seen).toEqual([...SCENES]);
    expect(s).toBe("clear");
  });

  it("paints only colours both themes define, in every scene, by day and by night", () => {
    for (const scene of SCENES) {
      for (const night of [true, false]) {
        const keys = new Set<Key>();
        for (const k of paintStatic(l, night, scene).keys) if (k) keys.add(k);
        for (const t of [0, 1.3, 7.7, 20]) {
          const w = weather(l, scene, night, t);
          for (const [, , k] of [...w.back, ...w.front]) keys.add(k);
        }
        for (const key of keys) {
          expect(PALETTES.dark, `${scene} ${key}`).toHaveProperty(key);
          expect(PALETTES.light, `${scene} ${key}`).toHaveProperty(key);
        }
      }
    }
  });

  it("keeps the clear garden exactly as it was", () => {
    expect(paintStatic(l, true, "clear").keys).toEqual(paintStatic(l, true).keys);
    const w = weather(l, "clear", true, 3);
    expect(w.back).toEqual([]);
    expect(w.front).toEqual([]);
  });

  it("hides the moon and stars behind a cloud deck in rain, storm and snow", () => {
    for (const scene of ["rain", "storm", "snow"] as const) {
      const { keys } = paintStatic(l, true, scene);
      for (let x = 0; x < l.w; x++) expect(CLOUD.has(at(keys, x, 0)), `${scene} x ${x}`).toBe(true);
      expect(keys.filter((k) => k === "moon" || k === "moon2" || k === "star3")).toEqual([]);
    }
  });

  it("drops rain only where the tree does not shelter it", () => {
    const roof = shelter(l)!;
    expect(roof).not.toBeNull();
    for (const scene of ["rain", "storm"] as const) {
      for (let t = 0; t < 4; t += 0.37) {
        const drops = weather(l, scene, true, t).front.filter(([, , k]) => k === "drop" || k === "dropFar");
        expect(drops.length).toBeGreaterThan(20);
        for (const [x, y] of drops) {
          if (x >= roof.from && x <= roof.to) expect(y, `x ${x} at ${t}`).toBeLessThan(roof.top);
        }
      }
    }
  });

  it("sends 煤球 under the tree in rain and leaves it free in other weather", () => {
    const rain = sceneSpots(l, "rain");
    const roof = shelter(l)!;
    expect(rain.minX).toBe(rain.maxX);
    expect(rain.minX).toBeGreaterThanOrEqual(roof.from - 4);
    expect(rain.minX + 16).toBeLessThanOrEqual(roof.to + 4);
    expect(sceneSpots(l, "clear")).toEqual(l.spots);
    expect(sceneSpots(l, "snow")).toEqual(l.spots);
  });

  it("flashes the storm sky now and then, never in the rain", () => {
    const flashes = (scene: "rain" | "storm") => {
      let n = 0;
      for (let t = 0; t < 60; t += 1 / 30) if (weather(l, scene, true, t).flash) n++;
      return n;
    };
    expect(flashes("rain")).toBe(0);
    const storm = flashes("storm");
    // A bolt every 6 to 12 s, 2 frames of flash each.
    expect(storm).toBeGreaterThanOrEqual(5 * 2);
    expect(storm).toBeLessThanOrEqual(11 * 3);
  });

  it("covers the grass line with snow", () => {
    const { keys } = paintStatic(l, true, "snow");
    let snow = 0;
    for (let x = 0; x < l.w; x++) if (at(keys, x, G) === "snow") snow++;
    expect(snow).toBeGreaterThan(l.w * 0.8);
    // The roof wears a cap too.
    expect(at(keys, peak, l.house.top + 3)).toBe("snow");
  });

  it("lets fog thicken towards the grass", () => {
    const { front } = weather(l, "fog", true, 0);
    const rows = (from: number, to: number) => front.filter(([, y]) => y >= from && y < to).length / (to - from);
    expect(rows(G - 8, G)).toBeGreaterThan(rows(4, 12));
    expect(rows(G - 8, G)).toBeGreaterThan(l.w * 0.3);
  });

  it("dresses the house for 春节: 横批, 春联 and a 福 on the door, and no moon on 除夕", () => {
    const { keys } = paintStatic(l, true, "spring");
    expect(at(keys, peak, G - 15)).toBe("gold");
    expect(at(keys, peak - 1, G - 15)).toBe("red");
    expect(at(keys, peak, G - 14)).toBe("red");
    for (const side of [-5, 5]) {
      expect(at(keys, peak + side, G - 13)).toBe("red");
      expect(at(keys, peak + side, G - 12)).toBe("brass");
    }
    expect(at(keys, peak, G - 10)).toBe("red"); // the 福 diamond
    expect(at(keys, peak, G - 8)).toBe("gold");
    expect(keys.filter((k) => k === "moon" || k === "moon2")).toEqual([]);
    // By day the sun is back.
    expect(paintStatic(l, false, "spring").keys.filter((k) => k === "moon").length).toBeGreaterThan(0);
  });

  it("hangs lanterns that glow by night and rest by day", () => {
    const night = weather(l, "spring", true, 0).back.map(([, , k]) => k);
    const day = weather(l, "spring", false, 0).back.map(([, , k]) => k);
    expect(night).toContain("redLit");
    expect(day).toContain("redDark");
    expect(day).not.toContain("redLit");
  });

  it("bursts fireworks in 12 rays no wider than 9 cells, then lets them fall", () => {
    for (const color of ["red", "gold", "g4"] as const) {
      const fw = { x: 100, y: 20, born: 0, color };
      for (let t = 0; t < 2; t += 0.1) {
        for (const [x, y] of burst(fw, t)) {
          expect(Math.abs(x - fw.x)).toBeLessThanOrEqual(9);
          expect(y - fw.y).toBeLessThanOrEqual(12);
          expect(fw.y - y).toBeLessThanOrEqual(9);
        }
      }
      expect(burst(fw, 0.5).length).toBeGreaterThanOrEqual(12);
      expect(burst(fw, 5)).toEqual([]);
    }
  });
});
