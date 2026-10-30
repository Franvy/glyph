import { describe, expect, it } from "vitest";
import { SCENES } from "./themes";
import { panAt, petCue, skyCue } from "./sounds";

describe("skyCue", () => {
  it("launches a firework on a Lunar New Year night, drops red paper by day", () => {
    expect(skyCue("spring", true)).toBe("firework");
    expect(skyCue("spring", false)).toBe("paper");
  });

  it("drops rain in rain and storm, day or night", () => {
    for (const night of [true, false]) {
      expect(skyCue("rain", night)).toBe("drop");
      expect(skyCue("storm", night)).toBe("drop");
    }
  });

  it("adds a firefly on a clear or cloudy night", () => {
    expect(skyCue("clear", true)).toBe("firefly");
    expect(skyCue("cloudy", true)).toBe("firefly");
  });

  it("stays silent where a click in the sky draws nothing", () => {
    expect(skyCue("clear", false)).toBeNull();
    expect(skyCue("cloudy", false)).toBeNull();
    for (const night of [true, false]) {
      expect(skyCue("snow", night)).toBeNull();
      expect(skyCue("fog", night)).toBeNull();
    }
  });

  it("knows every scene", () => {
    for (const scene of SCENES) expect(() => skyCue(scene, true)).not.toThrow();
  });
});

describe("petCue", () => {
  it("rings a coin for the 红包, pops a bubble for the heart", () => {
    expect(petCue("spring")).toBe("hongbao");
    expect(petCue("clear")).toBe("heart");
    expect(petCue("snow")).toBe("heart");
  });
});

describe("panAt", () => {
  it("places a sound left to right, never hard to one side", () => {
    expect(panAt(0, 200)).toBeCloseTo(-0.6);
    expect(panAt(100, 200)).toBeCloseTo(0);
    expect(panAt(200, 200)).toBeCloseTo(0.6);
  });

  it("clamps points outside the scene, and centres an empty one", () => {
    expect(panAt(-50, 200)).toBeCloseTo(-0.6);
    expect(panAt(900, 200)).toBeCloseTo(0.6);
    expect(panAt(10, 0)).toBe(0);
  });
});
