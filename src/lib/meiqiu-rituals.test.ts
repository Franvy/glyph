import { describe, expect, it } from "vitest";
import { gardenRituals, ritualFrame, RITUALS, type GardenRitual } from "./meiqiu-rituals";

describe("Meiqiu's rituals", () => {
  it("picks outdoor activities that suit the scene", () => {
    expect(gardenRituals("clear", false, false)).toEqual(["nap", "water", "hike", "fish"]);
    expect(gardenRituals("clear", false, true)).toEqual(["kite", "nap", "water", "hike", "fish"]);
    expect(gardenRituals("clear", true, true)).toEqual(["stars"]);
    expect(gardenRituals("cloudy", true, false)).toEqual([]);
    expect(gardenRituals("snow", false, false)).toEqual(["snow"]);
    for (const scene of ["rain", "storm", "spring", "halloween", "fog"] as const) {
      expect(gardenRituals(scene, false, true)).toEqual([]);
    }
  });

  it("plays each sequence through once and then hands back control", () => {
    expect(ritualFrame("fish", 0)).toBe(0);
    expect(ritualFrame("fish", 0.9)).toBe(0);
    expect(ritualFrame("fish", 1.1)).toBe(1);
    for (const id of Object.keys(RITUALS) as GardenRitual[]) {
      const { holds } = RITUALS[id];
      let elapsed = 0;
      holds.forEach((hold, frame) => {
        expect(ritualFrame(id, elapsed + hold / 2)).toBe(frame);
        elapsed += hold;
      });
      expect(ritualFrame(id, elapsed)).toBeNull();
    }
  });
});
