import { z } from "astro/zod";

// Open-Meteo: no key, free for non-commercial use (10,000 calls a day). https://open-meteo.com/en/docs
const HANGZHOU = { city: "Hangzhou", latitude: "30.27", longitude: "120.16" } as const;
const CURRENT = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "weather_code",
  "is_day",
  "wind_speed_10m",
] as const;

/** Seconds the Worker keeps a response. Open-Meteo updates the current block every 15 minutes. */
export const WEATHER_CACHE_TTL = 900;

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

export function weatherUrl(): string {
  const params = new URLSearchParams({
    latitude: HANGZHOU.latitude,
    longitude: HANGZHOU.longitude,
    current: CURRENT.join(","),
    timezone: "Asia/Shanghai",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

// WMO code table, as Open-Meteo documents it.
const CODES: Record<number, [condition: string, kind: WeatherKind]> = {
  0: ["Clear", "clear"],
  1: ["Mainly clear", "clear"],
  2: ["Partly cloudy", "cloudy"],
  3: ["Overcast", "cloudy"],
  45: ["Fog", "fog"],
  48: ["Freezing fog", "fog"],
  51: ["Light drizzle", "drizzle"],
  53: ["Drizzle", "drizzle"],
  55: ["Heavy drizzle", "drizzle"],
  56: ["Freezing drizzle", "drizzle"],
  57: ["Freezing drizzle", "drizzle"],
  61: ["Light rain", "rain"],
  63: ["Rain", "rain"],
  65: ["Heavy rain", "rain"],
  66: ["Freezing rain", "rain"],
  67: ["Freezing rain", "rain"],
  71: ["Light snow", "snow"],
  73: ["Snow", "snow"],
  75: ["Heavy snow", "snow"],
  77: ["Snow grains", "snow"],
  80: ["Light showers", "rain"],
  81: ["Showers", "rain"],
  82: ["Heavy showers", "rain"],
  85: ["Snow showers", "snow"],
  86: ["Heavy snow showers", "snow"],
  95: ["Thunderstorm", "thunder"],
  96: ["Thunderstorm with hail", "thunder"],
  99: ["Thunderstorm with hail", "thunder"],
};

export function describeWeatherCode(code: number): { condition: string; kind: WeatherKind } {
  const [condition, kind] = CODES[code] ?? ["Unknown", "unknown"];
  return { condition, kind };
}

const OpenMeteoBody = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    weather_code: z.number().int(),
    is_day: z.union([z.literal(0), z.literal(1)]),
    wind_speed_10m: z.number(),
  }),
});

/** The API response as the page shows it, or null when it does not have the expected shape. */
export function parseWeather(body: unknown): Weather | null {
  const parsed = OpenMeteoBody.safeParse(body);
  if (!parsed.success) return null;
  const c = parsed.data.current;
  return {
    city: HANGZHOU.city,
    observedAt: c.time,
    temperature: Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    humidity: Math.round(c.relative_humidity_2m),
    windSpeed: Math.round(c.wind_speed_10m),
    isDay: c.is_day === 1,
    code: c.weather_code,
    ...describeWeatherCode(c.weather_code),
  };
}

// Caiyun: its realtime sky comes from weather radar, so it sees a shower that Open-Meteo's model misses.
// Free plan: 1,000 calls a day. https://docs.caiyunapp.com/weather-api/
export function caiyunUrl(token: string): string {
  return `https://api.caiyunapp.com/v2.6/${encodeURIComponent(token)}/${HANGZHOU.longitude},${HANGZHOU.latitude}/realtime`;
}

// Caiyun's skycon, with the nearest WMO code so `code` means the same for both sources.
// Caiyun has no thunder: its heaviest rain gets the storm garden.
const SKYCONS: Record<string, [condition: string, kind: WeatherKind, code: number]> = {
  CLEAR_DAY: ["Clear", "clear", 0],
  CLEAR_NIGHT: ["Clear", "clear", 0],
  PARTLY_CLOUDY_DAY: ["Partly cloudy", "cloudy", 2],
  PARTLY_CLOUDY_NIGHT: ["Partly cloudy", "cloudy", 2],
  CLOUDY: ["Overcast", "cloudy", 3],
  LIGHT_HAZE: ["Light haze", "fog", 45],
  MODERATE_HAZE: ["Haze", "fog", 45],
  HEAVY_HAZE: ["Heavy haze", "fog", 45],
  LIGHT_RAIN: ["Light rain", "rain", 61],
  MODERATE_RAIN: ["Rain", "rain", 63],
  HEAVY_RAIN: ["Heavy rain", "rain", 65],
  STORM_RAIN: ["Rainstorm", "thunder", 95],
  FOG: ["Fog", "fog", 45],
  LIGHT_SNOW: ["Light snow", "snow", 71],
  MODERATE_SNOW: ["Snow", "snow", 73],
  HEAVY_SNOW: ["Heavy snow", "snow", 75],
  STORM_SNOW: ["Snowstorm", "snow", 75],
  DUST: ["Dust", "fog", 45],
  SAND: ["Sand", "fog", 45],
  WIND: ["Windy", "cloudy", 3],
};

export function describeSkycon(skycon: string): { condition: string; kind: WeatherKind; code: number } {
  const [condition, kind, code] = SKYCONS[skycon] ?? ["Unknown", "unknown", -1];
  return { condition, kind, code };
}

const CaiyunBody = z.object({
  status: z.literal("ok"),
  /** Unix seconds. Caiyun gives no time of its own for the reading. */
  server_time: z.number(),
  result: z.object({
    realtime: z.object({
      status: z.literal("ok"),
      temperature: z.number(),
      apparent_temperature: z.number(),
      /** 0 to 1. */
      humidity: z.number(),
      skycon: z.string(),
      /** Sunlight on the ground, W/m². */
      dswrf: z.number(),
      wind: z.object({ speed: z.number() }),
    }),
  }),
});

/** Unix seconds as local time in Shanghai, "2026-10-22T14:00" (UTC+8, no daylight saving). */
function shanghaiTime(seconds: number): string {
  return new Date((seconds + 8 * 3600) * 1000).toISOString().slice(0, 16);
}

/** Caiyun's response as the page shows it, or null when it failed or does not have the expected shape. */
export function parseCaiyun(body: unknown): Weather | null {
  const parsed = CaiyunBody.safeParse(body);
  if (!parsed.success) return null;
  const r = parsed.data.result.realtime;
  const { condition, kind, code } = describeSkycon(r.skycon);
  return {
    city: HANGZHOU.city,
    observedAt: shanghaiTime(parsed.data.server_time),
    temperature: Math.round(r.temperature),
    feelsLike: Math.round(r.apparent_temperature),
    humidity: Math.round(r.humidity * 100),
    windSpeed: Math.round(r.wind.speed),
    // CLEAR_DAY / CLEAR_NIGHT say it; CLOUDY and RAIN do not, so any sunlight means day.
    isDay: r.skycon.endsWith("_NIGHT") ? false : r.skycon.endsWith("_DAY") || r.dswrf > 0,
    code,
    condition,
    kind,
  };
}

async function ask(url: string, parse: (body: unknown) => Weather | null, fetcher: typeof fetch, timeoutMs: number) {
  try {
    const res = await fetcher(url, {
      signal: AbortSignal.timeout(timeoutMs),
      // Workers' own fetch cache: every visitor in the TTL shares one upstream call. Other runtimes ignore `cf`.
      cf: { cacheTtl: WEATHER_CACHE_TTL, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) return null;
    return parse(await res.json());
  } catch {
    return null;
  }
}

/**
 * Current weather in Hangzhou, or null on any failure (network, HTTP error, bad body, timeout),
 * so the page can leave the block out. With a Caiyun token it asks Caiyun first and Open-Meteo
 * only when Caiyun fails. The endpoint passes the global fetch; tests pass a stub.
 */
export async function getWeather(fetcher: typeof fetch = fetch, timeoutMs = 5000, caiyunToken = ""): Promise<Weather | null> {
  const radar = caiyunToken ? await ask(caiyunUrl(caiyunToken), parseCaiyun, fetcher, timeoutMs) : null;
  return radar ?? ask(weatherUrl(), parseWeather, fetcher, timeoutMs);
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
