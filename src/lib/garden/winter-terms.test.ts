import { describe, expect, it } from "vitest";
import { PALETTES } from "./palette";
import { layout, paintStatic, sunAltitude } from "./scene";
import {
  fallingPersimmonY,
  launchMeteor,
  majorSnowDecor,
  majorSnowFlakes,
  MAX_DROPPED_PERSIMMONS,
  MAX_WINTERSWEET_BLOOMS,
  meteorFrame,
  minorSnowDecor,
  minorSnowGraupel,
  nextSnowCatStage,
  openWintersweet,
  persimmonBoughBox,
  shakePersimmon,
  snowCatBox,
  winterberryBox,
  winterSolsticeDecor,
  wintersweetBox,
} from "./winter-terms";

const wide = layout(222, 74);
const narrow = layout(140, 74);

describe("winter solar terms", () => {
  it("lowers the daytime sun step by step across Minor Snow, Major Snow and Winter Solstice", () => {
    expect(sunAltitude("clear")).toBe(11);
    expect(sunAltitude("minor-snow")).toBe(18);
    expect(sunAltitude("major-snow")).toBe(21);
    expect(sunAltitude("winter-solstice")).toBe(24);
  });

  it("keeps the sky open (no cloud deck) in all three winter solar terms", () => {
    for (const scene of ["minor-snow", "major-snow", "winter-solstice"] as const) {
      const { keys } = paintStatic(wide, true, scene);
      expect(keys.some((k) => k === "moon" || k === "moon2")).toBe(true);
      expect(keys.some((k) => k === "deck")).toBe(false);
    }
  });

  it("enforces the Minor Snow reserve rule (留柿待禽): at most 3 persimmons drop, 2 always stay", () => {
    let dropped = 0;
    for (let i = 0; i < MAX_DROPPED_PERSIMMONS; i++) {
      const res = shakePersimmon(dropped);
      expect(res.spawned).toBe(true);
      dropped = res.nextDropped;
    }
    expect(dropped).toBe(3);
    const extra = shakePersimmon(dropped);
    expect(extra.spawned).toBe(false);
    expect(extra.nextDropped).toBe(3);

    // Falling persimmon lands on the grass with a 1-cell bounce.
    const item = { x: 30, fromY: 42, toY: wide.ground - 4, born: 0 };
    expect(fallingPersimmonY(item, 0)).toBe(42);
    expect(fallingPersimmonY(item, 0.75)).toBe(wide.ground - 4);
  });

  it("falls back to compact narrow-screen props below 180 cells", () => {
    expect(narrow.tree).toBeNull();
    expect(narrow.fence).toBeNull();
    const sprig = persimmonBoughBox(narrow);
    expect(sprig.w).toBe(8);
    expect(sprig.h).toBe(7);

    const snowCat = snowCatBox(narrow);
    expect(snowCat.x).toBe(Math.max(2, narrow.house.x - 26));
    const berry = winterberryBox(narrow);
    expect(berry.x).toBeGreaterThanOrEqual(narrow.house.x);

    const ws = wintersweetBox(narrow);
    expect(ws.w).toBe(8);
    expect(ws.h).toBe(8);
  });

  it("melts Minor Snow graupel at night and hides flurries in dry daylight", () => {
    expect(minorSnowGraupel(wide, false, 3)).toEqual([]);
    expect(minorSnowGraupel(wide, true, 3, true)).toHaveLength(6);
    // Over a full cycle some pellets form 2 × 1 ice-blue melt beads on G - 1.
    let sawBead = false;
    for (let t = 0; t < 35; t += 0.2) {
      if (minorSnowGraupel(wide, true, t).some(([, y, k]) => y === wide.ground - 1 && k === "lamp")) {
        sawBead = true;
        break;
      }
    }
    expect(sawBead).toBe(true);
  });

  it("cycles Major Snow snow-Meiqiu through stages 1 -> 2 -> 3 -> 1 and keeps ice shadow in light mode", () => {
    expect(nextSnowCatStage(1)).toBe(2);
    expect(nextSnowCatStage(2)).toBe(3);
    expect(nextSnowCatStage(3)).toBe(1);

    const light = paintStatic(wide, false, "major-snow");
    expect(light.keys.includes("snow")).toBe(true);
    expect(light.keys.includes("ice")).toBe(true);
    expect(PALETTES.light.ice).toBe("#b8d2f7");

    // Flurry increases hex crystal density.
    expect(majorSnowFlakes(wide, 1, 4).length).toBeGreaterThan(majorSnowFlakes(wide, 1, 0).length);

    // Reduced-motion mode still renders icicle glint when active.
    const stillGlint = majorSnowDecor(wide, 0, { stage: 1, glintAt: 0, prints: [] }, true);
    expect(stillGlint.some(([, , key]) => key === "glint")).toBe(true);
    const stillNoGlint = majorSnowDecor(wide, 0, { stage: 1, glintAt: null, prints: [] }, true);
    expect(stillNoGlint.some(([, , key]) => key === "glint")).toBe(false);
  });

  it("opens Winter Solstice wintersweet buds up to 9 and allows at most one meteor in flight", () => {
    let blooms = 4;
    for (let i = 0; i < 10; i++) blooms = openWintersweet(blooms);
    expect(blooms).toBe(MAX_WINTERSWEET_BLOOMS);

    const first = launchMeteor(null, wide, 120, 14, 10);
    expect(launchMeteor(first, wide, 80, 10, 10.5)).toBe(first);
    const second = launchMeteor(first, wide, 80, 10, 11.3);
    expect(second).not.toBe(first);
    expect(meteorFrame(first, 10.4).length).toBeGreaterThan(0);
    expect(meteorFrame(first, 11.5)).toEqual([]);
  });

  it("uses only defined palette keys across all dynamic winter term decorations", () => {
    const all = [
      ...minorSnowDecor(wide, true, 1.2, { fanned: true, dropped: 1, swayUntil: 2, falling: [{ x: 30, fromY: 42, toY: 59, born: 1 }] }),
      ...minorSnowDecor(wide, false, 1.2, { fanned: false, dropped: 0, swayUntil: 0, falling: [] }),
      ...minorSnowGraupel(wide, true, 1.2),
      ...majorSnowDecor(wide, 1.2, { stage: 3, glintAt: 1.1, prints: [{ x: 80, row: 0, born: 0.5 }] }),
      ...majorSnowFlakes(wide, 1.2, 3),
      ...winterSolsticeDecor(wide, 1.2, { stoked: true, blooms: 7, meteor: launchMeteor(null, wide, 120, 14, 1), petals: [{ x: 80, y: 48, born: 1 }] }),
    ];
    for (const [, , key] of all) {
      expect(PALETTES.dark, `dark ${key}`).toHaveProperty(key);
      expect(PALETTES.light, `light ${key}`).toHaveProperty(key);
    }
  });
});
