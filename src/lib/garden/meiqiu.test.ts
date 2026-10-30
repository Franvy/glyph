import { describe, expect, it } from "vitest";
import { type Cat, type World, CHASE_SPEED, WALK_SPEED, newCat, poseOf, step } from "./meiqiu";

const world = (over: Partial<World> = {}): World => ({
  hoverCat: false,
  hoverHouse: false,
  pounce: null,
  spots: { minX: 0, maxX: 200, cushion: 140, bowl: 166, flowers: [40, 98], butterfly: 112 },
  ...over,
});

// Fixed "random" so a test never depends on luck.
const rng = () => 0.5;

function run(cat: Cat, seconds: number, w: World, dt = 1 / 60) {
  let c = cat;
  for (let t = 0; t < seconds; t += dt) c = step(c, dt, w, rng);
  return c;
}

describe("煤球", () => {
  it("walks toward its target at walking pace and faces the way it goes", () => {
    const cat = { ...newCat(50), mode: "walk" as const, target: 100, goal: "wander" as const };
    const after = step(cat, 1, world(), rng);
    expect(after.x).toBeCloseTo(50 + WALK_SPEED);
    expect(after.dir).toBe(1);
  });

  it("sits once it gets there, then picks a new place to go", () => {
    const cat = { ...newCat(99.5), mode: "walk" as const, target: 100, goal: "flower" as const };
    const sat = step(cat, 1 / 60, world(), rng);
    expect(sat.mode).toBe("sit");
    let c = sat;
    let walked = false;
    for (let t = 0; t < 6; t += 1 / 60) {
      c = step(c, 1 / 60, world(), rng);
      walked ||= c.mode === "walk";
    }
    expect(walked).toBe(true);
  });

  it("stops and purrs while the cursor is on it", () => {
    const cat = { ...newCat(80), mode: "walk" as const, target: 150, goal: "wander" as const };
    const petted = run(cat, 0.5, world({ hoverCat: true }));
    expect(petted.mode).toBe("happy");
    expect(petted.x).toBeCloseTo(80, 0);
    expect(poseOf(petted, 0)).toBe("happy");
  });

  it("goes back to its day shortly after the cursor leaves", () => {
    const petted = run(newCat(80), 0.2, world({ hoverCat: true }));
    const after = run(petted, 1, world());
    expect(after.mode).not.toBe("happy");
  });

  it("walks to the cushion and sleeps while the house is hovered", () => {
    const asleep = run(newCat(60), 20, world({ hoverHouse: true }));
    expect(asleep.mode).toBe("sleep");
    expect(asleep.x).toBeCloseTo(140, 0);
    expect(poseOf(asleep, 0)).toBe("sleep");
  });

  it("keeps sleeping for 3 s after the cursor leaves the house, then wakes", () => {
    const asleep = run(newCat(140), 1, world({ hoverHouse: true }));
    expect(run(asleep, 2.5, world()).mode).toBe("sleep");
    expect(run(asleep, 3.5, world()).mode).not.toBe("sleep");
  });

  it("goes alert, then sprints after the yarn and catches it", () => {
    const alert = step(newCat(60), 1 / 60, world({ pounce: 150 }), rng);
    expect(alert.mode).toBe("alert");
    expect(poseOf(alert, 0)).toBe("alert");
    const chasing = run(alert, 0.6, world());
    expect(chasing.mode).toBe("chase");
    const before = chasing.x;
    const next = step(chasing, 0.5, world(), rng);
    expect(next.x - before).toBeCloseTo(CHASE_SPEED * 0.5);
    let caught = next;
    for (let i = 0; i < 600 && caught.mode === "chase"; i++) caught = step(caught, 1 / 60, world(), rng);
    expect(caught.mode).toBe("sit");
    expect(caught.goal).toBe("yarn");
    expect(caught.x).toBeCloseTo(150 - 8, 0);
  });

  it("never leaves the garden", () => {
    const cat = { ...newCat(5), mode: "walk" as const, target: -40, goal: "wander" as const };
    expect(run(cat, 20, world()).x).toBeGreaterThanOrEqual(0);
    expect(step(newCat(60), 1 / 60, world({ pounce: 900 }), rng).target).toBeLessThanOrEqual(200);
  });

  it("alternates the two walk frames while it walks", () => {
    const cat = { ...newCat(50), mode: "walk" as const, target: 150, goal: "wander" as const };
    const frames = new Set([0, 0.13, 0.26, 0.39].map((t) => poseOf(run(cat, t, world()), 0)));
    expect(frames).toEqual(new Set(["walk1", "walk2"]));
  });
});
