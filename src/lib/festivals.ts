import { Lunar, Solar } from "lunar-typescript";

type Rule =
  | { lunar: [month: number, day: number] }
  | { solar: [month: number, day: number] }
  /** The day before lunar new year: the last day of month 12, which has 29 or 30 days. */
  | { eve: true }
  | { term: "qingming" | "winter-solstice" };

/**
 * The festivals that get a theme. Order is priority: when two fall on one day, the earlier one wins.
 * The id becomes `<html data-festival="...">`; the CSS for each theme keys on it.
 */
export const FESTIVALS = [
  { id: "new-years-eve", name: "New Year's Eve", rule: { eve: true } },
  { id: "spring-festival", name: "Spring Festival", rule: { lunar: [1, 1] } },
  { id: "lantern", name: "Lantern Festival", rule: { lunar: [1, 15] } },
  { id: "qingming", name: "Qingming", rule: { term: "qingming" } },
  { id: "dragon-boat", name: "Dragon Boat Festival", rule: { lunar: [5, 5] } },
  { id: "qixi", name: "Qixi", rule: { lunar: [7, 7] } },
  { id: "mid-autumn", name: "Mid-Autumn Festival", rule: { lunar: [8, 15] } },
  { id: "double-ninth", name: "Double Ninth", rule: { lunar: [9, 9] } },
  { id: "winter-solstice", name: "Winter Solstice", rule: { term: "winter-solstice" } },
  { id: "laba", name: "Laba", rule: { lunar: [12, 8] } },
  { id: "new-year", name: "New Year's Day", rule: { solar: [1, 1] } },
  { id: "labour-day", name: "Labour Day", rule: { solar: [5, 1] } },
  { id: "national-day", name: "National Day", rule: { solar: [10, 1] } },
] as const satisfies readonly { id: string; name: string; rule: Rule }[];

export type FestivalId = (typeof FESTIVALS)[number]["id"];

/** "YYYY-MM-DD" → festival id. */
export type FestivalTable = Record<string, FestivalId>;

function datesFor(rule: Rule, year: number): string[] {
  if ("solar" in rule) return [Solar.fromYmd(year, rule.solar[0], rule.solar[1]).toYmd()];
  // Lunar new year always falls between 21 Jan and 20 Feb, so the eve is in the same solar year.
  if ("eve" in rule) return [Lunar.fromYmd(year, 1, 1).next(-1).getSolar().toYmd()];
  if ("term" in rule) {
    // Qingming is the last jie before 30 Apr; the winter solstice is the last qi before 31 Dec.
    return rule.term === "qingming"
      ? [Solar.fromYmd(year, 4, 30).getLunar().getPrevJie().getSolar().toYmd()]
      : [Solar.fromYmd(year, 12, 31).getLunar().getPrevQi().getSolar().toYmd()];
  }
  // A lunar date of year N can land in solar year N or N + 1 (Laba does), so try both lunar years.
  const [month, day] = rule.lunar;
  return [year - 1, year]
    .map((lunarYear) => Lunar.fromYmd(lunarYear, month, day).getSolar().toYmd())
    .filter((ymd) => ymd.startsWith(`${year}-`));
}

// The home page renders on demand, so the layout asks for the table on each request. Keep each year once.
const byYear = new Map<number, FestivalTable>();

/** Every festival day in one solar year. */
export function festivalDates(year: number): FestivalTable {
  const cached = byYear.get(year);
  if (cached) return cached;
  const table: FestivalTable = {};
  for (const festival of FESTIVALS) {
    for (const ymd of datesFor(festival.rule, year)) table[ymd] ??= festival.id;
  }
  byYear.set(year, table);
  return table;
}

/** Festival days for `years` solar years from `fromYear`. The layout inlines this table into each page. */
export function festivalTable(fromYear: number, years: number): FestivalTable {
  return Object.assign({}, ...Array.from({ length: years }, (_, i) => festivalDates(fromYear + i)));
}

/** "YYYY-MM-DD" in Shanghai. China has one zone and no daylight saving, so a fixed +8 h is exact. */
export function shanghaiDate(date: Date): string {
  return new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

export function festivalOn(date: Date): FestivalId | null {
  const ymd = shanghaiDate(date);
  return festivalDates(Number(ymd.slice(0, 4)))[ymd] ?? null;
}
