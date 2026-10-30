import type { WeatherKind } from "../weather";
import type { SceneName } from "./themes";

const BY_WEATHER: Record<WeatherKind, SceneName> = {
  clear: "clear",
  cloudy: "cloudy",
  fog: "fog",
  drizzle: "rain",
  rain: "rain",
  thunder: "storm",
  snow: "snow",
  unknown: "clear",
};

/** The garden scene for the weather outside (Paper: banner · 天气, "sceneOf(code)"). */
export function sceneOfWeather(kind: WeatherKind): SceneName {
  return BY_WEATHER[kind];
}

/** Festivals (by <html data-festival>) that have a garden of their own. It wins over the weather. */
const BY_FESTIVAL: Record<string, SceneName> = {
  "new-years-eve": "spring",
  "spring-festival": "spring",
};

/**
 * Which garden the banner shows, first match wins: the test switch on this page, a festival garden,
 * the live weather, and last the scene saved in /admin (when the weather cannot be loaded).
 */
export function bannerScene(input: {
  picked: SceneName | null;
  festival: string | null;
  weather: WeatherKind | null;
  saved: SceneName;
}): SceneName {
  if (input.picked) return input.picked;
  const festival = input.festival ? BY_FESTIVAL[input.festival] : undefined;
  if (festival) return festival;
  return input.weather ? sceneOfWeather(input.weather) : input.saved;
}
