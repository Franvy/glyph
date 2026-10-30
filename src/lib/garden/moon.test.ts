import { describe, expect, it } from "vitest";
import { MOON_PHASES, moonAge, moonArt, phaseOfAge, tonightsPhase } from "./moon";

const lit = (rows: readonly string[]) => rows.join("").replace(/[^#+]/g, "").length;

describe("moon", () => {
  it("knows the moon's age from known new and full moons", () => {
    // New moon 8 Apr 2024 18:21 UTC (the total eclipse), full moon 23 Apr 2024 23:49 UTC.
    const fresh = moonAge(new Date("2024-04-08T18:21Z"));
    expect(Math.min(fresh, 29.53 - fresh)).toBeLessThan(1);
    expect(moonAge(new Date("2024-04-23T23:49Z"))).toBeCloseTo(14.8, 0);
  });

  it("sorts each day of the moon's age into one of eight phases", () => {
    const days = Array.from({ length: 30 }, (_, d) => phaseOfAge(d + 0.5));
    expect(days).toEqual([
      ...Array(2).fill("new"),
      ...Array(4).fill("waxingCrescent"),
      ...Array(3).fill("firstQuarter"),
      ...Array(5).fill("waxingGibbous"),
      ...Array(3).fill("full"),
      ...Array(4).fill("waningGibbous"),
      ...Array(3).fill("lastQuarter"),
      ...Array(4).fill("waningCrescent"),
      ...Array(2).fill("new"),
    ]);
  });

  it("shows the moon of the Shanghai evening, so it changes once a day at Shanghai midnight", () => {
    // 23:59 and 00:01 in Shanghai on either side of 15 Apr 2024: one day apart.
    const before = new Date("2024-04-14T15:59Z");
    const after = new Date("2024-04-14T16:01Z");
    expect(moonAge(after, "Asia/Shanghai") - moonAge(before, "Asia/Shanghai")).toBeCloseTo(1, 5);
    // The whole of one Shanghai day shares one phase.
    expect(moonAge(new Date("2024-04-14T16:01Z"), "Asia/Shanghai")).toBe(
      moonAge(new Date("2024-04-15T15:59Z"), "Asia/Shanghai"),
    );
    expect(tonightsPhase(new Date("2026-10-25T12:00Z"))).toBe("full");
    expect(tonightsPhase(new Date("2026-11-01T12:00Z"))).toBe("lastQuarter");
  });

  it("draws every phase inside the same 11 × 11 disc", () => {
    for (const phase of MOON_PHASES) {
      const rows = moonArt(phase);
      expect(rows).toHaveLength(11);
      rows.forEach((row, y) => {
        expect(row).toHaveLength(11);
        [...row].forEach((c, x) => {
          const inside = (x - 5) ** 2 + (y - 5) ** 2 <= 27;
          expect(c === " ", `${phase} ${x},${y}`).toBe(!inside);
        });
      });
    }
  });

  it("lights none of the new moon, all of the full moon, and more each day in between", () => {
    expect(lit(moonArt("new"))).toBe(0);
    expect(moonArt("full").join("")).not.toContain(".");
    const waxing = (["new", "waxingCrescent", "firstQuarter", "waxingGibbous", "full"] as const).map((p) => lit(moonArt(p)));
    for (let i = 1; i < waxing.length; i++) expect(waxing[i]).toBeGreaterThan(waxing[i - 1]);
  });

  it("lights the right side while it waxes and the left side while it wanes", () => {
    for (const [waxing, waning] of [
      ["waxingCrescent", "waningCrescent"],
      ["firstQuarter", "lastQuarter"],
      ["waxingGibbous", "waningGibbous"],
    ] as const) {
      const right = moonArt(waxing);
      expect(moonArt(waning)).toEqual(right.map((row) => [...row].reverse().join("")));
      // The far right column is lit, the far left is dark.
      expect(right[5][10]).toBe("#");
      expect(right[5][0]).toBe(".");
    }
  });
});
