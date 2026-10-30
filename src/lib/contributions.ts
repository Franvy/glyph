// A year of daily commit counts, laid out GitHub-style: one column per week, Sunday on top.

export type Day = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type ContributionYear = {
  weeks: Day[][];
  months: { label: string; week: number }[];
  total: number;
  longest: number;
  current: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86_400_000;

export function levelOf(count: number): Day["level"] {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

/** Longest run of active days anywhere, and the run that ends on the last day. */
export function streaks(counts: number[]): { longest: number; current: number } {
  let longest = 0;
  let run = 0;
  for (const count of counts) {
    run = count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { longest, current: run };
}

/**
 * Builds `weekCount` weeks ending on the week of `end` (a UTC date).
 * Days after `end` in the final week are left out, so the last column may be short.
 */
export function buildYear(counts: (date: Date) => number, end: Date, weekCount = 52): ContributionYear {
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const start = last - new Date(last).getUTCDay() * DAY - (weekCount - 1) * 7 * DAY;

  const weeks: Day[][] = [];
  const months: ContributionYear["months"] = [];
  const all: number[] = [];

  for (let w = 0; w < weekCount; w++) {
    const week: Day[] = [];
    for (let d = 0; d < 7; d++) {
      const time = start + (w * 7 + d) * DAY;
      if (time > last) break;
      const date = new Date(time);
      const count = Math.max(0, Math.round(counts(date)));
      week.push({ date: date.toISOString().slice(0, 10), count, level: levelOf(count) });
      all.push(count);
    }
    // A month is labelled on the first week that starts inside it.
    const first = new Date(start + w * 7 * DAY);
    const month = first.getUTCMonth();
    if (w === 0 ? first.getUTCDate() <= 7 : new Date(start + (w - 1) * 7 * DAY).getUTCMonth() !== month) {
      months.push({ label: MONTHS[month], week: w });
    }
    weeks.push(week);
  }

  return { weeks, months, total: all.reduce((sum, c) => sum + c, 0), ...streaks(all) };
}

/**
 * The calendar from stored days ({ date: "2026-10-20", count }). It ends on the last stored day,
 * or on `today` when there are none. A day that is not stored counts as zero.
 */
export function yearFromDays(days: { date: string; count: number }[], today: Date): ContributionYear {
  const counts = new Map(days.map((d) => [d.date, d.count]));
  const end = days.length ? new Date(`${days.at(-1)!.date}T00:00:00Z`) : today;
  return buildYear((date) => counts.get(date.toISOString().slice(0, 10)) ?? 0, end);
}

/** Where the last `n` weeks start, and their total: the short calendar on a phone. */
export function lastWeeks(year: ContributionYear, n: number): { from: number; total: number } {
  const from = Math.max(0, year.weeks.length - n);
  const total = year.weeks.slice(from).flat().reduce((sum, day) => sum + day.count, 0);
  return { from, total };
}

/**
 * One shade per week for the last `n` weeks: the GitHub hover card's strip. A week is shaded by its
 * daily average, so the short current week is not lighter only because it has fewer days.
 */
export function weekLevels(year: ContributionYear, n: number): Day["level"][] {
  const weeks = year.weeks.slice(lastWeeks(year, n).from);
  const means = weeks.map((week) => (week.length ? week.reduce((sum, day) => sum + day.count, 0) / week.length : 0));
  const top = Math.max(0, ...means);
  return means.map((mean) => (top ? (Math.ceil((4 * mean) / top) as Day["level"]) : 0));
}

/** Deterministic stand-in counts (mulberry32), denser towards the recent end. */
export function sampleCounts(seed: number, end: Date, weekCount = 52) {
  const span = weekCount * 7 * DAY;
  return (date: Date) => {
    let t = (seed + Math.floor(date.getTime() / DAY)) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const recency = 1 - (end.getTime() - date.getTime()) / span;
    const active = r < 0.35 + recency * 0.5;
    return active ? 1 + Math.floor(((r * 7919) % 1) * (3 + recency * 8)) : 0;
  };
}

/** The two halves of a cell's tooltip: "5 contributions" and "Oct 20, 2026". */
export function describeDay(day: Day): { count: string; date: string } {
  const [y, m, d] = day.date.split("-").map(Number);
  const count = day.count === 0 ? "No contributions" : `${day.count} contribution${day.count === 1 ? "" : "s"}`;
  return { count, date: `${MONTHS[m - 1]} ${d}, ${y}` };
}
