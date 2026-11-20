export type WeatherKind = "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "thunder" | "unknown";

export interface Weather {
  city: string;
  /** Local time in Shanghai, "2026-10-22T14:00". */
  observedAt: string;
  /** °C, rounded. */
  temperature: number;
  feelsLike: number;
  /** %. */
  humidity: number;
  /** km/h, rounded. */
  windSpeed: number;
  isDay: boolean;
  /** WMO weather code. */
  code: number;
  condition: string;
  kind: WeatherKind;
}

/** The browser hides a reading older than this. */
export const WEATHER_MAX_AGE_MS = 2 * 3600_000;

/** `observedAt` is local time in Shanghai, which is UTC+8 with no daylight saving. */
export function observedInstant(observedAt: string): Date {
  return new Date(`${observedAt}+08:00`);
}

/** True when the reading is over two hours old, or its time cannot be read. */
export function isStale(observedAt: string, now: Date): boolean {
  const at = observedInstant(observedAt).getTime();
  return Number.isNaN(at) || now.getTime() - at > WEATHER_MAX_AGE_MS;
}
