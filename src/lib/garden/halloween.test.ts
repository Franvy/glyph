import { describe, expect, it } from "vitest";
import { decorations, ghostFrame, summonGhost, pumpkinBoxes, WITCH_HAT } from "./halloween";
import { layout, paintStatic } from "./scene";

const l = layout(222, 74);

describe("Halloween garden", () => {
  it("keeps the real moon and the blue landscape", () => {
    expect(paintStatic(l, true, "halloween").keys).toEqual(paintStatic(l, true, "clear").keys);
    expect(WITCH_HAT.length).toBeGreaterThan(10);
  });

  it("lights the pumpkin cutouts at night, with an explicit off state", () => {
    expect(decorations(l, true, 0, true).map((p) => p[2])).toContain("candle");
    expect(decorations(l, true, 0, false).map((p) => p[2])).not.toContain("candle");
    expect(decorations(l, false, 0, false).map((p) => p[2])).not.toContain("candle");
    for (const box of pumpkinBoxes(l)) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(l.w);
      expect(box.y + box.h).toBe(l.ground);
    }
  });

  it("moves bats only at night and only when motion is allowed", () => {
    expect(decorations(l, false, 9, false)).toEqual(decorations(l, false, 10, false));
    expect(decorations(l, true, 9, true, true)).toEqual(decorations(l, true, 10, true, true));
    expect(decorations(l, true, 9, true)).not.toEqual(decorations(l, true, 10, true));
  });

  it("caps ghosts at one, clamps their position and expires them after 1.6 seconds", () => {
    const ghost = summonGhost(null, l, 999, -99, 10)!;
    expect(ghost.x).toBeLessThanOrEqual(l.w - 10);
    expect(ghost.y).toBeGreaterThanOrEqual(5);
    expect(summonGhost(ghost, l, 30, 20, 10.2)).toBe(ghost);
    expect(ghostFrame(ghost, 10.8).dots.length).toBeGreaterThan(0);
    expect(ghostFrame(ghost, 11.5).opacity).toBeLessThan(1);
    expect(ghostFrame(ghost, 11.6).dots).toEqual([]);
    expect(summonGhost(ghost, l, 30, 20, 12)).not.toBe(ghost);
  });
});
