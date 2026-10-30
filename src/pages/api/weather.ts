import type { APIRoute } from "astro";
import { hangzhouWeather } from "@/data/weather";
import { WEATHER_CACHE_TTL } from "@/lib/weather";

export const prerender = false; // reads Caiyun (or Open-Meteo) on demand

export const GET: APIRoute = async () => {
  const weather = await hangzhouWeather();
  if (!weather) {
    return Response.json({ error: "The weather service did not answer. Try again later." }, { status: 503 });
  }
  // The Worker already shares one upstream call per TTL; the browser may keep the reply as long.
  return Response.json(weather, { headers: { "cache-control": `public, max-age=${WEATHER_CACHE_TTL}` } });
};
