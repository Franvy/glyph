import { describe, expect, it } from "vitest";
import { calendarBox, launchSparkler, MAX_SPARKLERS, newYearDecor } from "./new-year";
import { PALETTES } from "./palette";
import { layout, paintStatic, sunAltitude } from "./scene";
import {
  broomBox,
  fallingPersimmonY,
  hawthornPostBox,
  iceMirrorBox,
  launchColdGust,
  launchDiamondStar,
  launchMeteor,
  magpieNestBox,
  majorColdDecor,
  majorSnowDecor,
  majorSnowFlakes,
  MAX_DROPPED_PERSIMMONS,
  MAX_WINTERSWEET_BLOOMS,
  meteorFrame,
  minorColdDecor,
  minorSnowDecor,
  minorSnowGraupel,
  nextNestStage,
  nextSnowCatStage,
  openWintersweet,
  persimmonBoughBox,
  pluckHawthorn,
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

  it("completes the daytime winter sun altitude arc across New Year, Minor Cold and Major Cold", () => {
    expect(sunAltitude("new-year")).toBe(22);
    expect(sunAltitude("minor-cold")).toBe(21);
    expect(sunAltitude("major-cold")).toBe(18);
  });

  it("keeps the sky open (no cloud deck) in New Year, Minor Cold and Major Cold", () => {
    for (const scene of ["new-year", "minor-cold", "major-cold"] as const) {
      const { keys } = paintStatic(wide, true, scene);
      expect(keys.some((k) => k === "moon" || k === "moon2")).toBe(true);
      expect(keys.some((k) => k === "deck")).toBe(false);
    }
  });

  it("provides narrow-screen fallbacks for New Year, Minor Cold and Major Cold below 180 cells", () => {
    const cal = calendarBox(narrow);
    expect(cal.x).toBe(Math.max(2, narrow.house.x - 14));

    const nest = magpieNestBox(narrow);
    expect(nest.w).toBe(12);
    expect(nest.h).toBe(9);
    expect(iceMirrorBox(narrow).w).toBe(14);

    const broom = broomBox(narrow);
    expect(broom.x).toBeGreaterThanOrEqual(narrow.house.x - 10);
    const post = hawthornPostBox(narrow);
    expect(post.x).toBe(Math.max(2, narrow.house.x - 28));
  });

  it("caps New Year sparklers at 2 active bursts and renders both 31 and 01 calendar pages", () => {
    let list = launchSparkler([], wide, 120, 18, 1);
    list = launchSparkler(list, wide, 90, 14, 1.2);
    list = launchSparkler(list, wide, 150, 16, 1.4);
    expect(list).toHaveLength(MAX_SPARKLERS);

    const oldPage = newYearDecor(wide, true, 1.5, { turned: false, tearBorn: null, sparklers: list });
    const newPage = newYearDecor(wide, true, 1.5, { turned: true, tearBorn: 1.2, sparklers: list });
    expect(newPage.some(([, , k]) => k === "mint")).toBe(true);
    expect(oldPage.some(([, , k]) => k === "pageFold")).toBe(true);
  });

  it("builds Minor Cold magpie nest up to stage 3 without resetting and renders daytime narcissus contrast rim", () => {
    expect(nextNestStage(1)).toBe(2);
    expect(nextNestStage(2)).toBe(3);
    expect(nextNestStage(3)).toBe(3);

    const star = launchDiamondStar(null, wide, 125, 16, 5);
    expect(launchDiamondStar(star, wide, 80, 12, 5.4)).toBe(star);
    expect(launchDiamondStar(star, wide, 80, 12, 6.2)).not.toBe(star);

    const dayDecor = minorColdDecor(wide, false, 1, { nestStage: 3, streakBorn: 0.5, star, feathers: [] });
    expect(dayDecor.some(([, , k]) => k === "rime")).toBe(true);
  });

  it("cycles Major Cold hawthorn skewers 3 -> 2 -> 1 -> 3 and sweeps frost gust cleanly", () => {
    expect(pluckHawthorn(3)).toBe(2);
    expect(pluckHawthorn(2)).toBe(1);
    expect(pluckHawthorn(1)).toBe(3);

    const gust = launchColdGust(null, wide, 120, 20, 3);
    expect(launchColdGust(gust, wide, 90, 16, 3.5)).toBe(gust);
    expect(launchColdGust(gust, wide, 90, 16, 4.3)).not.toBe(gust);
  });

  it("uses only defined palette keys across all dynamic winter term and New Year decorations", () => {
    const all = [
      ...minorSnowDecor(wide, true, 1.2, { fanned: true, dropped: 1, swayUntil: 2, falling: [{ x: 30, fromY: 42, toY: 59, born: 1 }] }),
      ...minorSnowDecor(wide, false, 1.2, { fanned: false, dropped: 0, swayUntil: 0, falling: [] }),
      ...minorSnowGraupel(wide, true, 1.2),
      ...majorSnowDecor(wide, 1.2, { stage: 3, glintAt: 1.1, prints: [{ x: 80, row: 0, born: 0.5 }] }),
      ...majorSnowFlakes(wide, 1.2, 3),
      ...winterSolsticeDecor(wide, 1.2, { stoked: true, blooms: 7, meteor: launchMeteor(null, wide, 120, 14, 1), petals: [{ x: 80, y: 48, born: 1 }] }),
      ...newYearDecor(wide, true, 1.2, { turned: true, tearBorn: 1.0, sparklers: launchSparkler([], wide, 126, 15, 1.0) }),
      ...newYearDecor(wide, false, 1.2, { turned: true, tearBorn: null, sparklers: [] }),
      ...minorColdDecor(wide, true, 1.2, { nestStage: 3, streakBorn: 1.0, star: launchDiamondStar(null, wide, 126, 16, 1.0), feathers: [{ x: 84, y: 50, born: 1.0 }] }),
      ...minorColdDecor(wide, false, 1.2, { nestStage: 3, streakBorn: null, star: null, feathers: [] }),
      ...majorColdDecor(wide, true, 1.2, { swept: true, sweepBorn: 1.0, hawthorns: 2, pluckGlintUntil: 1.4, gust: launchColdGust(null, wide, 120, 20, 1.0) }),
      ...majorColdDecor(wide, false, 1.2, { swept: false, sweepBorn: null, hawthorns: 3, pluckGlintUntil: 0, gust: null }),
    ];
    for (const [, , key] of all) {
      expect(PALETTES.dark, `dark ${key}`).toHaveProperty(key);
      expect(PALETTES.light, `light ${key}`).toHaveProperty(key);
    }
  });
});
