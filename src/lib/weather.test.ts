import { describe, expect, it } from "vitest";
import {
  caiyunUrl,
  describeSkycon,
  describeWeatherCode,
  getWeather,
  isStale,
  observedInstant,
  parseCaiyun,
  parseWeather,
  weatherUrl,
} from "./weather";

// The shape Open-Meteo returns for `current=...` (trimmed to the fields we ask for).
const sample = {
  latitude: 30.25,
  longitude: 120.125,
  timezone: "Asia/Shanghai",
  current: {
    time: "2026-10-22T14:00",
    interval: 900,
    temperature_2m: 18.4,
    apparent_temperature: 17.2,
    relative_humidity_2m: 81,
    weather_code: 61,
    is_day: 1,
    wind_speed_10m: 9.7,
  },
};

function respond(body: unknown, status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("weatherUrl", () => {
  it("asks Open-Meteo for Hangzhou in the Shanghai zone", () => {
    const url = new URL(weatherUrl());
    expect(url.origin).toBe("https://api.open-meteo.com");
    expect(url.searchParams.get("latitude")).toBe("30.27");
    expect(url.searchParams.get("longitude")).toBe("120.16");
    expect(url.searchParams.get("timezone")).toBe("Asia/Shanghai");
    expect(url.searchParams.get("current")).toContain("weather_code");
  });
});

describe("parseWeather", () => {
  it("turns the response into the reading the page shows", () => {
    expect(parseWeather(sample)).toEqual({
      city: "Hangzhou",
      observedAt: "2026-10-22T14:00",
      temperature: 18,
      feelsLike: 17,
      humidity: 81,
      windSpeed: 10,
      isDay: true,
      code: 61,
      condition: "Light rain",
      kind: "rain",
    });
  });

  it("rejects a response without the current block", () => {
    expect(parseWeather({ latitude: 30.25 })).toBeNull();
    expect(parseWeather({ current: { ...sample.current, temperature_2m: "warm" } })).toBeNull();
  });
});

describe("describeWeatherCode", () => {
  it("names each WMO group", () => {
    expect(describeWeatherCode(0)).toEqual({ condition: "Clear", kind: "clear" });
    expect(describeWeatherCode(3)).toEqual({ condition: "Overcast", kind: "cloudy" });
    expect(describeWeatherCode(45).kind).toBe("fog");
    expect(describeWeatherCode(53).kind).toBe("drizzle");
    expect(describeWeatherCode(81).kind).toBe("rain");
    expect(describeWeatherCode(73).kind).toBe("snow");
    expect(describeWeatherCode(95).kind).toBe("thunder");
  });

  it("falls back for a code it does not know", () => {
    expect(describeWeatherCode(42)).toEqual({ condition: "Unknown", kind: "unknown" });
  });
});

describe("getWeather", () => {
  it("returns the reading on success", async () => {
    expect((await getWeather(respond(sample)))?.condition).toBe("Light rain");
  });

  it("returns null when the API fails, so the page can hide the block", async () => {
    expect(await getWeather(respond({ error: true, reason: "x" }, 400))).toBeNull();
    expect(await getWeather(respond("not json"))).toBeNull();
    expect(
      await getWeather(async () => {
        throw new TypeError("network down");
      }),
    ).toBeNull();
  });

  it("gives up after the timeout", async () => {
    const hang: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    expect(await getWeather(hang, 20)).toBeNull();
  });
});

describe("observedInstant", () => {
  it("reads the Shanghai local time as UTC+8", () => {
    expect(observedInstant("2026-10-22T14:00").toISOString()).toBe("2026-10-22T06:00:00.000Z");
  });
});

describe("isStale", () => {
  const at = "2026-10-22T14:00"; // 06:00 UTC

  it("is fresh up to two hours after the reading", () => {
    expect(isStale(at, new Date("2026-10-22T06:10:00Z"))).toBe(false);
    expect(isStale(at, new Date("2026-10-22T08:00:00Z"))).toBe(false);
  });

  it("is stale after two hours, or when the time cannot be read", () => {
    expect(isStale(at, new Date("2026-10-22T08:00:01Z"))).toBe(true);
    expect(isStale("yesterday", new Date("2026-10-22T06:10:00Z"))).toBe(true);
  });
});

// The shape Caiyun returns for /realtime (trimmed to the fields we read).
const caiyun = {
  status: "ok",
  api_version: "v2.6",
  timezone: "Asia/Shanghai",
  server_time: 1792648800, // 2026-10-22 14:00 in Shanghai
  result: {
    realtime: {
      status: "ok",
      temperature: 18.4,
      apparent_temperature: 17.2,
      humidity: 0.81,
      skycon: "LIGHT_RAIN",
      dswrf: 210.5,
      wind: { speed: 9.7, direction: 120 },
      precipitation: { local: { status: "ok", datasource: "radar", intensity: 0.4 } },
    },
  },
};

describe("caiyunUrl", () => {
  it("asks Caiyun for the realtime reading in Hangzhou, longitude first", () => {
    const url = new URL(caiyunUrl("test-token"));
    expect(url.origin).toBe("https://api.caiyunapp.com");
    expect(url.pathname).toBe("/v2.6/test-token/120.16,30.27/realtime");
  });

  it("escapes the token", () => {
    expect(new URL(caiyunUrl("a/b")).pathname).toBe("/v2.6/a%2Fb/120.16,30.27/realtime");
  });
});

describe("parseCaiyun", () => {
  it("turns the response into the reading the page shows", () => {
    expect(parseCaiyun(caiyun)).toEqual({
      city: "Hangzhou",
      observedAt: "2026-10-22T14:00",
      temperature: 18,
      feelsLike: 17,
      humidity: 81,
      windSpeed: 10,
      isDay: true,
      code: 61,
      condition: "Light rain",
      kind: "rain",
    });
  });

  it("reads day or night from the skycon, else from the sunlight", () => {
    const at = (skycon: string, dswrf: number) =>
      parseCaiyun({ ...caiyun, result: { realtime: { ...caiyun.result.realtime, skycon, dswrf } } })?.isDay;
    expect(at("CLEAR_NIGHT", 300)).toBe(false);
    expect(at("CLEAR_DAY", 0)).toBe(true);
    expect(at("CLOUDY", 0)).toBe(false);
    expect(at("CLOUDY", 12)).toBe(true);
  });

  it("rejects a failed or malformed response", () => {
    expect(parseCaiyun({ status: "failed", error: "token is invalid", api_version: "2.6" })).toBeNull();
    expect(parseCaiyun({ ...caiyun, result: { realtime: { ...caiyun.result.realtime, status: "failed" } } })).toBeNull();
    expect(parseCaiyun({ ...caiyun, result: { realtime: { ...caiyun.result.realtime, temperature: "warm" } } })).toBeNull();
  });
});

describe("describeSkycon", () => {
  it("maps each Caiyun sky to a garden kind", () => {
    expect(describeSkycon("CLEAR_NIGHT")).toMatchObject({ condition: "Clear", kind: "clear" });
    expect(describeSkycon("PARTLY_CLOUDY_DAY")).toMatchObject({ condition: "Partly cloudy", kind: "cloudy" });
    expect(describeSkycon("CLOUDY").kind).toBe("cloudy");
    expect(describeSkycon("LIGHT_RAIN").kind).toBe("rain");
    expect(describeSkycon("HEAVY_RAIN").kind).toBe("rain");
    // Caiyun has no thunder: its heaviest rain gets the storm garden.
    expect(describeSkycon("STORM_RAIN")).toMatchObject({ condition: "Rainstorm", kind: "thunder" });
    expect(describeSkycon("MODERATE_SNOW").kind).toBe("snow");
    expect(describeSkycon("FOG").kind).toBe("fog");
    expect(describeSkycon("HEAVY_HAZE").kind).toBe("fog");
  });

  it("falls back for a sky it does not know", () => {
    expect(describeSkycon("METEORS")).toEqual({ condition: "Unknown", kind: "unknown", code: -1 });
  });
});

describe("getWeather with a Caiyun token", () => {
  const route = (answers: { caiyun: () => Promise<Response>; openMeteo: () => Promise<Response> }): typeof fetch =>
    async (input) => (String(input).startsWith("https://api.caiyunapp.com") ? answers.caiyun() : answers.openMeteo());
  const json = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

  it("takes the radar reading from Caiyun", async () => {
    const fetcher = route({ caiyun: json(caiyun), openMeteo: json({ ...sample, current: { ...sample.current, weather_code: 0 } }) });
    expect((await getWeather(fetcher, 5000, "test-token"))?.kind).toBe("rain");
  });

  it("falls back to Open-Meteo when Caiyun fails", async () => {
    const clear = { ...sample, current: { ...sample.current, weather_code: 0 } };
    const down = async () => {
      throw new TypeError("network down");
    };
    expect((await getWeather(route({ caiyun: down, openMeteo: json(clear) }), 5000, "test-token"))?.kind).toBe("clear");
    const invalid = json({ status: "failed", error: "token is invalid" }, 400);
    expect((await getWeather(route({ caiyun: invalid, openMeteo: json(clear) }), 5000, "test-token"))?.kind).toBe("clear");
  });

  it("asks only Open-Meteo without a token", async () => {
    const asked: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      asked.push(new URL(String(input)).host);
      return new Response(JSON.stringify(sample));
    };
    await getWeather(fetcher, 5000, "");
    expect(asked).toEqual(["api.open-meteo.com"]);
  });
});
