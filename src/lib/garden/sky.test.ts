import { describe, expect, it } from "vitest";
import { bannerScene, sceneOfWeather } from "./sky";

describe("sceneOfWeather", () => {
  it("gives each kind of weather its garden scene", () => {
    expect(sceneOfWeather("clear")).toBe("clear");
    expect(sceneOfWeather("cloudy")).toBe("cloudy");
    expect(sceneOfWeather("drizzle")).toBe("rain");
    expect(sceneOfWeather("rain")).toBe("rain");
    expect(sceneOfWeather("thunder")).toBe("storm");
    expect(sceneOfWeather("snow")).toBe("snow");
    expect(sceneOfWeather("fog")).toBe("fog");
  });

  it("shows the plain garden for a code it does not know", () => {
    expect(sceneOfWeather("unknown")).toBe("clear");
  });
});

describe("bannerScene", () => {
  const none = { picked: null, festival: null, weather: null, saved: "cloudy" } as const;

  it("follows the live weather", () => {
    expect(bannerScene({ ...none, weather: "rain" })).toBe("rain");
  });

  it("falls back to the scene saved in /admin when there is no live weather", () => {
    expect(bannerScene(none)).toBe("cloudy");
  });

  it("shows the Lunar New Year garden on New Year's Eve and the Spring Festival, whatever the weather", () => {
    expect(bannerScene({ ...none, festival: "new-years-eve", weather: "rain" })).toBe("spring");
    expect(bannerScene({ ...none, festival: "spring-festival", weather: "snow" })).toBe("spring");
  });

  it("keeps the weather on a festival that has no garden of its own", () => {
    expect(bannerScene({ ...none, festival: "mid-autumn", weather: "fog" })).toBe("fog");
    expect(bannerScene({ ...none, festival: "not-a-festival", weather: "fog" })).toBe("fog");
  });

  it("lets the test switch override everything", () => {
    expect(bannerScene({ picked: "snow", festival: "spring-festival", weather: "rain", saved: "clear" })).toBe("snow");
  });
});
