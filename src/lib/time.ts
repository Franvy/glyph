/** "21:34" in the given IANA zone, 24-hour. */
export function formatClock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

/** Minutes east of UTC for `timeZone` at `date` (Shanghai → 480). */
export function zoneOffsetMinutes(timeZone: string, date: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!match) return 0; // "GMT" alone is UTC
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

/**
 * How the host's clock relates to the visitor's: "same time as you",
 * "2h ahead", "5.5h behind". `visitorOffset` is minutes east of UTC.
 */
export function describeOffset(hostZone: string, date: Date, visitorOffset: number): string {
  const diff = zoneOffsetMinutes(hostZone, date) - visitorOffset;
  if (diff === 0) return "same time as you";
  const hours = Math.round((Math.abs(diff) / 60) * 10) / 10;
  return `${hours}h ${diff > 0 ? "ahead" : "behind"}`;
}
