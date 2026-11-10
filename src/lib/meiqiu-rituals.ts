import type { SceneName } from "./garden/themes";

export const RITUAL_WIDTH = 32;
export const RITUAL_HEIGHT = 24;

// Hold each Paper keyframe for the length of its beat, in seconds.
export const RITUALS = {
  hike: { holds: [0.32, 0.32, 0.32, 0.45] },
  water: { holds: [0.62, 0.5, 0.66, 0.92] },
  fish: { holds: [1.05, 0.45, 0.44, 0.96] },
  nap: { holds: [0.64, 0.56, 0.76, 1.14] },
  kite: { holds: [0.62, 0.56, 0.52, 0.9] },
  stars: { holds: [0.76, 0.44, 0.62, 1.08] },
  snow: { holds: [0.64, 0.66, 0.36, 1.24] },
};

export type GardenRitual = keyof typeof RITUALS;

export function gardenRituals(scene: SceneName, night: boolean, windy: boolean): GardenRitual[] {
  if (scene === "snow") return ["snow"];
  if (night) return scene === "clear" ? ["stars"] : [];
  if (scene === "clear") return windy ? ["kite", "nap", "water", "hike", "fish"] : ["nap", "water", "hike", "fish"];
  if (scene === "cloudy") return windy ? ["kite", "hike", "fish"] : ["hike", "fish"];
  return [];
}

export function ritualFrame(id: GardenRitual, elapsed: number) {
  let end = 0;
  const frame = RITUALS[id].holds.findIndex((hold) => {
    end += hold;
    return elapsed < end;
  });
  return frame < 0 ? null : frame;
}

export const ritualArt = (id: GardenRitual) => `/sprites/meiqiu/${id}.svg`;
