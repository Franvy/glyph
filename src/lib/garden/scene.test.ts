import { describe, expect, it } from "vitest";
import { PALETTES } from "./palette";
import { MOON_PHASES } from "./moon";
import { gridSize, layout, paintStatic, windows } from "./scene";

describe("garden scene", () => {
  it("turns the banner size into a 3 px grid that covers it", () => {
    expect(gridSize(666, 220)).toEqual({ w: 222, h: 74 });
    expect(gridSize(350, 176)).toEqual({ w: 117, h: 59 });
  });

  it("keeps the soil 11 rows deep and the house inside the right edge", () => {
    for (const [w, h] of [
      [222, 74],
      [117, 59],
    ]) {
      const l = layout(w, h);
      expect(l.ground).toBe(h - 11);
      expect(l.house.x + l.house.w).toBeLessThanOrEqual(w);
      expect(l.cushion).toBeLessThan(l.house.x);
      expect(l.moon.x + 5).toBeLessThan(l.house.x);
    }
  });

  it("drops the tree and fence when the banner is narrow", () => {
    expect(layout(222, 74).tree).not.toBeNull();
    expect(layout(222, 74).fence).not.toBeNull();
    expect(layout(117, 59).tree).toBeNull();
    expect(layout(117, 59).fence).toBeNull();
  });

  it("gives 煤球 a walking range clear of the house", () => {
    const l = layout(222, 74);
    expect(l.spots.minX).toBeGreaterThanOrEqual(0);
    expect(l.spots.maxX + 16).toBeLessThanOrEqual(l.house.x + l.house.w);
  });

  it("builds the home: 39 wide, 30 tall to the ear tips, clear of the bowl", () => {
    for (const [w, h] of [
      [222, 74],
      [117, 59],
    ]) {
      const l = layout(w, h);
      expect(l.house.w).toBe(39);
      expect(l.ground - l.house.top).toBe(30);
      // The walls start 3 cells in from the eaves; the bowl sits left of them.
      expect(l.bowl + 8).toBeLessThanOrEqual(l.house.x + 3);
      // 煤球's walk ends 2 cells short of the left wall, as it did with the old house.
      expect(l.spots.maxX + 16).toBe(l.house.x + 1);
    }
  });

  it("gives the home one round-topped door, a doorstep and a straight gable", () => {
    const l = layout(222, 74);
    const { keys, w } = paintStatic(l, true);
    const at = (x: number, y: number) => keys[y * w + x];
    const peak = l.house.x + 19;
    const G = l.ground;
    // One door, 7 wide, its top row cut back to 5.
    expect(at(peak - 3, G - 11)).toBe("door");
    expect(at(peak + 3, G - 11)).toBe("door");
    expect(at(peak - 4, G - 11)).toBe("wall");
    expect(at(peak - 3, G - 12)).toBe("wall");
    expect(at(peak - 2, G - 12)).toBe("door");
    expect(at(peak, G - 12)).toBe("door"); // no gap between two leaves
    expect(at(peak + 1, G - 8)).toBe("wood3"); // knob
    // The doorstep sits on the soil line, 9 wide.
    for (let x = peak - 4; x <= peak + 4; x++) expect(at(x, G)).toBe("wood3");
    // A straight gable: the eaves are 1 row below the walls' top, 19 cells out from the peak.
    expect(at(peak - 19, G - 17)).toBe("ridge");
    expect(at(peak - 16, G - 16)).toBe("wallEdge");
    expect(at(peak - 4, G - 27)).toBe("ridge");
    // Dark bands on every third roof row from the fourth: rows 4, 7 and 10 below the ridge.
    const bands = [];
    for (let i = 1; i <= 10; i++) if (at(peak + 3, G - 27 + i) === "roof2") bands.push(i);
    expect(bands).toEqual([4, 7, 10]);
  });

  it("stands the home on the grass, with no dark gaps under the walls", () => {
    for (const w of [222, 160]) {
      const l = layout(w, 74);
      const { keys } = paintStatic(l, true);
      const at = (x: number, y: number) => keys[y * w + x];
      const peak = l.house.x + 19;
      const G = l.ground;
      // Paper (House): the soil line under the walls is grass, with one dark cell in every 5.
      for (let x = peak - 16; x <= peak + 16; x++) {
        if (Math.abs(x - peak) <= 4) continue; // doorstep
        expect(at(x, G)).toBe((x - peak + 22) % 5 === 0 ? "soilTop" : "g2");
      }
      // Tufts every 7 cells grow in front of the bottom wall row.
      for (const dx of [-15, -8, -1, 6, 13]) expect(at(peak + dx, G - 1)).toBe("g3");
    }
  });

  it("lights 4 rows of glass per window, split by a bar", () => {
    const l = layout(222, 74);
    const G = l.ground;
    const lights = windows(l, true);
    const rows = new Set(lights.filter(([x]) => x < l.house.x + 19).filter(([, y]) => y > G - 16).map(([, y]) => y));
    expect([...rows].sort((a, b) => a - b)).toEqual([G - 12, G - 11, G - 9, G - 8]);
  });

  it("keeps the window lights inside the house", () => {
    const l = layout(222, 74);
    for (const [x, y] of windows(l, true)) {
      expect(x).toBeGreaterThanOrEqual(l.house.x);
      expect(x).toBeLessThan(l.house.x + l.house.w);
      expect(y).toBeGreaterThanOrEqual(l.house.top);
      expect(y).toBeLessThan(l.ground);
    }
  });

  it("paints only colours both themes define", () => {
    const keys = new Set(paintStatic(layout(222, 74), true).keys.filter(Boolean));
    for (const key of paintStatic(layout(222, 74), false).keys) if (key) keys.add(key);
    for (const key of keys) {
      expect(PALETTES.dark).toHaveProperty(key as string);
      expect(PALETTES.light).toHaveProperty(key as string);
    }
  });

  it("paints tonight's phase at night, with the dark side in moonDark", () => {
    const l = layout(222, 74);
    const count = (keys: (string | null)[], key: string) => keys.filter((k) => k === key).length;
    const fresh = paintStatic(l, true, "clear", "new").keys;
    expect(count(fresh, "moon")).toBe(0);
    expect(count(fresh, "moonDark")).toBeGreaterThan(80);
    const full = paintStatic(l, true, "clear", "full").keys;
    expect(count(full, "moonDark")).toBe(0);
    expect(count(full, "moon") + count(full, "moon2")).toBe(count(fresh, "moonDark"));
    // Waxing: every lit cell is right of the centre column.
    const { x: mx } = l.moon;
    paintStatic(l, true, "clear", "waxingCrescent").keys.forEach((k, i) => {
      if (k === "moon") expect(i % l.w).toBeGreaterThan(mx);
    });
  });

  it("keeps the round sun by day, whatever the phase", () => {
    const l = layout(222, 74);
    const sun = paintStatic(l, false, "clear", "full").keys;
    for (const phase of MOON_PHASES) expect(paintStatic(l, false, "clear", phase).keys).toEqual(sun);
    expect(sun.filter((k) => k === "moonDark")).toEqual([]);
  });

  it("is the same garden on every visit", () => {
    const a = paintStatic(layout(222, 74), true).keys;
    const b = paintStatic(layout(222, 74), true).keys;
    expect(a).toEqual(b);
  });
});
