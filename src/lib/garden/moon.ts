// The night moon shows the real phase, from the Paper board "Banner · 煤球的花园 月相 spec".
// One 11 × 11 disc, eight shapes. Shanghai is in the northern hemisphere: the lit side is on the
// right while the moon waxes and on the left while it wanes.

export const MOON_PHASES = [
  "new",
  "waxingCrescent",
  "firstQuarter",
  "waxingGibbous",
  "full",
  "waningGibbous",
  "lastQuarter",
  "waningCrescent",
] as const;
export type MoonPhase = (typeof MOON_PHASES)[number];

const SYNODIC = 29.530588853;
/** A known new moon: 6 Jan 2000, 18:14 UTC. The mean month drifts less than a day from the real one. */
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
/** The hour of the evening whose moon a day shows. */
const EVENING = 21;

/**
 * Days since the last new moon, 0 to 29.53. With a time zone it is the age at 21:00 of that
 * zone's date, so the moon changes once a day, at local midnight.
 */
export function moonAge(date: Date, timeZone?: string): number {
  let t = date.getTime();
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .reduce<Record<string, number>>((acc, p) => (p.type === "literal" ? acc : { ...acc, [p.type]: Number(p.value) }), {});
    const local = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const offset = local - Math.floor(t / 60000) * 60000;
    t = Date.UTC(parts.year, parts.month - 1, parts.day, EVENING) - offset;
  }
  const age = ((t - NEW_MOON) / 86400000) % SYNODIC;
  return age < 0 ? age + SYNODIC : age;
}

/** The last day of each phase, by whole days of age. Days 28–29 are new again. */
const LAST_DAY: [number, MoonPhase][] = [
  [1, "new"],
  [5, "waxingCrescent"],
  [8, "firstQuarter"],
  [13, "waxingGibbous"],
  [16, "full"],
  [20, "waningGibbous"],
  [23, "lastQuarter"],
  [27, "waningCrescent"],
];

export function phaseOfAge(age: number): MoonPhase {
  const day = Math.floor(age);
  return LAST_DAY.find(([last]) => day <= last)?.[1] ?? "new";
}

export function tonightsPhase(date: Date, timeZone = "Asia/Shanghai"): MoonPhase {
  return phaseOfAge(moonAge(date, timeZone));
}

const R2 = 27;
/** Grey maria on the full moon, so it never reads as the day sun. */
const MARIA = [[3, 3], [4, 3], [3, 4], [6, 6], [7, 6], [7, 7], [4, 7]];

/**
 * The phase as 11 rows of 11 cells: "#" lit, "+" the soft terminator and the maria,
 * "." the dark side (earthshine), " " sky.
 */
export function moonArt(phase: MoonPhase): string[] {
  const waxing = MOON_PHASES.indexOf(phase) < 4;
  const isLit = (x: number, dy: number) => {
    switch (phase) {
      case "new":
        return false;
      case "full":
        return true;
      case "firstQuarter":
      case "lastQuarter":
        return x >= 0;
      case "waxingCrescent":
      case "waningCrescent":
        // The disc less a larger shadow disc pushed toward the dark side.
        return (x + 2.9) ** 2 + dy * dy > 34;
      default:
        // Gibbous: the lit half plus an ellipse that bulges into the dark half.
        return x >= 0 || -x <= 0.62 * Math.sqrt(R2 - dy * dy) + 0.3;
    }
  };
  const cells: string[][] = [];
  for (let dy = -5; dy <= 5; dy++) {
    const row: string[] = [];
    for (let dx = -5; dx <= 5; dx++) {
      if (dx * dx + dy * dy > R2) row.push(" ");
      else row.push(isLit(waxing ? dx : -dx, dy) ? "#" : ".");
    }
    cells.push(row);
  }
  const art = cells.map((row) => row.map((c, x) => (c === "#" && (row[x - 1] === "." || row[x + 1] === ".") ? "+" : c)));
  if (phase === "full") for (const [x, y] of MARIA) art[y][x] = "+";
  return art.map((row) => row.join(""));
}
