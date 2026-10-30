import type { SceneName } from "./themes";

// What the garden plays, and where. Only what the visitor does makes a sound: the fireworks that go up by
// themselves at night, the storm's flashes and 煤球's walks stay silent. Synthesis: src/components/garden-sound.ts.

export type SkyCue = "firework" | "paper" | "drop" | "firefly";
export type PetCue = "heart" | "hongbao";

/** The sound of a click in the sky. It follows the banner's pointerdown branches: null where the click draws nothing. */
export function skyCue(scene: SceneName, night: boolean): SkyCue | null {
  if (scene === "spring") return night ? "firework" : "paper";
  if (scene === "rain" || scene === "storm") return "drop";
  if (night && (scene === "clear" || scene === "cloudy")) return "firefly";
  return null;
}

/** Petting 煤球 floats up a heart, or a 红包 at Lunar New Year. */
export function petCue(scene: SceneName): PetCue {
  return scene === "spring" ? "hongbao" : "heart";
}

/** Stereo position for cell `x` in a scene `w` cells wide: -0.6 (left) to 0.6 (right). */
export function panAt(x: number, w: number): number {
  if (w <= 0) return 0;
  const t = Math.max(0, Math.min(1, x / w));
  return (t * 2 - 1) * 0.6;
}
