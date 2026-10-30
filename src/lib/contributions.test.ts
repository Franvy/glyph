import { describe, expect, it } from "vitest";
import { buildYear, describeDay, lastWeeks, levelOf, sampleCounts, streaks, weekLevels, yearFromDays } from "./contributions";

const end = new Date("2026-10-20T00:00:00Z"); // a Tuesday

describe("streaks", () => {
  it("finds the longest run and the run that is still going", () => {
    expect(streaks([1, 1, 0, 2, 3, 4, 0, 1, 1])).toEqual({ longest: 3, current: 2 });
  });

  it("has no current streak when the last day is empty", () => {
    expect(streaks([1, 1, 0])).toEqual({ longest: 2, current: 0 });
    expect(streaks([])).toEqual({ longest: 0, current: 0 });
  });
});

describe("levelOf", () => {
  it("buckets counts into five shades", () => {
    expect([0, 1, 3, 6, 20].map(levelOf)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("buildYear", () => {
  it("lays out 52 Sunday-first weeks that stop on the end date", () => {
    const year = buildYear(() => 1, end);
    expect(year.weeks).toHaveLength(52);
    expect(year.weeks[0][0].date).toBe("2025-10-26");
    expect(new Date(year.weeks[0][0].date).getUTCDay()).toBe(0);
    expect(year.weeks.at(-1)?.map((d) => d.date)).toEqual(["2026-10-18", "2026-10-19", "2026-10-20"]);
    expect(year.total).toBe(51 * 7 + 3);
    expect(year.current).toBe(year.total);
  });

  it("labels each month once, at the first week that starts in it", () => {
    const { months } = buildYear(() => 0, end);
    expect(months.map((m) => m.label)).toEqual(["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
    expect(months[0].week).toBe(1); // 2025-11-02
  });

  it("never stores a negative or fractional count", () => {
    const year = buildYear((d) => (d.getUTCDate() % 2 ? -3 : 2.6), end);
    for (const day of year.weeks.flat()) expect(day.count === 0 || day.count === 3).toBe(true);
  });
});

describe("sampleCounts", () => {
  it("is deterministic for a seed", () => {
    const a = buildYear(sampleCounts(7, end), end);
    const b = buildYear(sampleCounts(7, end), end);
    expect(a).toEqual(b);
    expect(a.total).toBeGreaterThan(0);
  });
});

describe("describeDay", () => {
  it("says how many contributions fell on a day, and which day", () => {
    expect(describeDay({ date: "2026-10-20", count: 5, level: 3 })).toEqual({ count: "5 contributions", date: "Oct 20, 2026" });
    expect(describeDay({ date: "2026-01-02", count: 1, level: 1 })).toEqual({ count: "1 contribution", date: "Jan 2, 2026" });
    expect(describeDay({ date: "2025-12-31", count: 0, level: 0 })).toEqual({ count: "No contributions", date: "Dec 31, 2025" });
  });
});

describe("lastWeeks", () => {
  it("gives the first week index and the total of the last n weeks", () => {
    const year = buildYear(() => 1, end);
    expect(lastWeeks(year, 26)).toEqual({ from: 26, total: 25 * 7 + 3 });
  });

  it("covers the whole year when n is larger than it", () => {
    const year = buildYear(() => 2, end);
    expect(lastWeeks(year, 100)).toEqual({ from: 0, total: year.total });
  });
});

describe("weekLevels", () => {
  it("gives one shade per week for the last n weeks, the busiest week darkest", () => {
    // Week w has w contributions a day, so the counts grow left to right.
    const start = Date.UTC(2026, 3, 26); // the Sunday 26 weeks before the week of `end`
    const year = buildYear((date) => Math.max(0, Math.floor((date.getTime() - start) / (7 * 86_400_000))), end);
    const levels = weekLevels(year, 26);
    expect(levels).toHaveLength(26);
    expect(levels[0]).toBe(0);
    expect(levels.at(-1)).toBe(4);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("is all empty when there are no contributions", () => {
    expect(weekLevels(buildYear(() => 0, end), 26)).toEqual(Array(26).fill(0));
  });
});

describe("yearFromDays", () => {
  it("ends on the last stored day and fills missing days with zero", () => {
    const year = yearFromDays([{ date: "2026-10-19", count: 4 }, { date: "2026-10-20", count: 9 }], new Date("2026-10-30T00:00:00Z"));
    const last = year.weeks.at(-1)!;
    expect(last.map((d) => [d.date, d.count, d.level])).toEqual([
      ["2026-10-18", 0, 0],
      ["2026-10-19", 4, 2],
      ["2026-10-20", 9, 4],
    ]);
    expect(year.total).toBe(13);
  });

  it("shows an empty year ending today when there are no days yet", () => {
    const year = yearFromDays([], end);
    expect(year.weeks.at(-1)!.at(-1)!.date).toBe("2026-10-20");
    expect(year.total).toBe(0);
  });
});
