import { env } from "cloudflare:workers";
import { getWeather } from "@/lib/weather";

/** The weather in Hangzhou: Caiyun's radar when CAIYUN_TOKEN is set, else Open-Meteo (src/lib/weather.ts). */
export function hangzhouWeather() {
  return getWeather(fetch, 5000, env.CAIYUN_TOKEN ?? "");
}
