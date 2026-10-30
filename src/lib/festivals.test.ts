import { describe, expect, it } from "vitest";
import { FESTIVALS, festivalDates, festivalOn, festivalTable } from "./festivals";

describe("festivalDates", () => {
  it("places the lunar festivals on their solar dates (2026)", () => {
    const dates = festivalDates(2026);
    expect(dates["2026-02-16"]).toBe("new-years-eve");
    expect(dates["2026-02-17"]).toBe("spring-festival");
    expect(dates["2026-03-03"]).toBe("lantern");
    expect(dates["2026-06-19"]).toBe("dragon-boat");
    expect(dates["2026-08-19"]).toBe("qixi");
    expect(dates["2026-09-25"]).toBe("mid-autumn");
    expect(dates["2026-10-18"]).toBe("double-ninth");
    expect(dates["2026-01-26"]).toBe("laba");
  });

  it("places the solar terms and the fixed dates", () => {
    const dates = festivalDates(2026);
    expect(dates["2026-04-05"]).toBe("qingming");
    expect(dates["2026-12-22"]).toBe("winter-solstice");
    expect(dates["2026-01-01"]).toBe("new-year");
    expect(dates["2026-05-01"]).toBe("labour-day");
    expect(dates["2026-10-01"]).toBe("national-day");
  });

  it("finds New Year's Eve when the twelfth lunar month has 29 days", () => {
    // Lunar 2024 month 12 has 29 days: the eve of 2025 is 2025-01-28.
    expect(festivalDates(2025)["2025-01-28"]).toBe("new-years-eve");
  });

  it("gives every festival exactly one day a year", () => {
    for (const year of [2026, 2027, 2028, 2029]) {
      const ids = Object.values(festivalDates(year)).sort();
      expect(ids).toEqual(FESTIVALS.map((f) => f.id).sort());
    }
  });

  it("keeps the earlier festival in the list when two fall on one day", () => {
    // 2020-10-01 was both Mid-Autumn and National Day.
    expect(festivalDates(2020)["2020-10-01"]).toBe("mid-autumn");
  });
});

describe("festivalTable", () => {
  it("covers each year in the range", () => {
    const table = festivalTable(2026, 3);
    expect(table["2026-09-25"]).toBe("mid-autumn");
    expect(table["2028-01-01"]).toBe("new-year");
    expect(table["2029-01-01"]).toBeUndefined();
  });
});

describe("festivalOn", () => {
  it("reads the date in Shanghai, not UTC", () => {
    // 2026-09-24T16:30Z is 00:30 on the 25th in Shanghai.
    expect(festivalOn(new Date("2026-09-24T16:30:00Z"))).toBe("mid-autumn");
    expect(festivalOn(new Date("2026-09-24T15:30:00Z"))).toBeNull();
  });

  it("is null on an ordinary day", () => {
    expect(festivalOn(new Date("2026-10-22T04:00:00Z"))).toBeNull();
  });
});
