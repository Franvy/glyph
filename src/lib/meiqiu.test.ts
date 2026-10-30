import { describe, expect, it } from "vitest";
import { BALL_R, PX, POSES, ballResting, spriteSvg, stepBall, type Ball } from "./meiqiu";

const ART = /^[.#epfkaAhw]+$/;

// The Paper pose sheet "煤球 · SVG 动作表" (16 x 16), as "y,x,width" runs per colour,
// cropped to the rows the cat uses. # body · e eye · p blush.
function sheet(top: number, bottom: number, runs: Record<string, string>) {
  const grid = Array.from({ length: bottom - top + 1 }, () => Array(16).fill("."));
  for (const [c, list] of Object.entries(runs))
    for (const run of list.split("|")) {
      const [y, x, w] = run.split(",").map(Number);
      for (let i = 0; i < w; i++) grid[y - top][x + i] = c;
    }
  return grid.map((r) => r.join(""));
}
const BODY = [4, 5, 6, 7, 8, 9, 10, 11].map((y) => `${y},1,12`).join("|");
const EARS = "2,1,1|2,12,1|3,1,3|3,10,3";
const TAIL = "7,14,1|8,14,1|9,14,1|10,13,2";
const EYES = "6,3,1|6,10,1|7,3,1|7,10,1";
const CHEEKS = "8,2,2|8,10,2";

describe("meiqiu sprites", () => {
  it("draws every frame of a pose on the same grid, with known colours only", () => {
    for (const [name, pose] of Object.entries(POSES)) {
      const [first] = pose.frames;
      for (const frame of pose.frames) {
        expect(frame.length, name).toBe(first.length);
        for (const row of frame) {
          expect(row.length, `${name}: "${row}"`).toBe(first[0].length);
          expect(row, name).toMatch(ART);
        }
      }
    }
  });

  it("draws the poses of the Paper pose sheet pixel for pixel", () => {
    expect(POSES.sit.frames[0]).toEqual(sheet(2, 12, { "#": `${BODY}|${EARS}|${TAIL}|12,2,2|12,10,2`, e: EYES, p: CHEEKS }));
    expect(POSES.sit.frames.at(-1)).toEqual(sheet(2, 12, { "#": `${BODY}|${EARS}|${TAIL}|12,2,2|12,10,2`, e: "7,3,1|7,10,1", p: CHEEKS }));
    expect(POSES.purr.frames[0]).toEqual(
      sheet(2, 12, { "#": `${BODY}|${EARS}|6,14,1|${TAIL}|12,2,2|12,10,2`, e: "5,3,1|5,10,1|6,2,1|6,4,1|6,9,1|6,11,1", p: CHEEKS }),
    );
    expect(POSES.shock.frames[0]).toEqual(
      sheet(1, 13, {
        "#":
          [5, 6, 7, 8, 9, 10, 11, 12].map((y) => `${y},1,12`).join("|") +
          "|1,1,1|1,12,1|2,1,1|2,12,1|3,1,1|3,12,1|4,1,3|4,10,3|" +
          [1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => `${y},15,1`).join("|") +
          "|10,13,3|13,2,2|13,10,2",
        e: "6,3,1|6,10,1|7,3,1|7,10,1|8,3,1|8,10,1",
        p: "9,2,2|9,10,2",
      }),
    );
    expect(POSES.sleep.frames[0]).toEqual(
      sheet(4, 12, {
        "#": [5, 6, 7, 8, 9, 10, 11, 12].map((y) => `${y},1,12`).join("|") + "|4,1,3|4,10,3|12,13,3",
        e: "8,2,2|8,10,2",
        p: "9,2,2|9,10,2",
      }),
    );
  });

  it("walks and runs in profile: one eye, one cheek, four legs", () => {
    for (const name of ["walk", "run", "skid", "crouch", "pounce"] as const) {
      for (const frame of POSES[name].frames) {
        const art = frame.join("\n");
        expect(art.match(/e/g)?.length, name).toBeLessThanOrEqual(2); // one eye, one or two pixels tall
        expect(art.match(/p/g)?.length, name).toBe(2); // one cheek
      }
    }
  });

  it("keeps the crouch's build in profile: five rows of body under two of ears", () => {
    // a body row is a row the cat fills at least 11 cells wide
    const bodyRows = (frame: string[]) => frame.filter((r) => r.replace(/\./g, "").length >= 11).length;
    expect(bodyRows(POSES.crouch.frames[0])).toBe(5);
    for (const name of ["walk", "run", "skid", "pounce"] as const) {
      for (const frame of POSES[name].frames) expect(bodyRows(frame), name).toBe(5);
    }
  });

  it("walks and runs in four steps, not two", () => {
    expect(POSES.walk.frames).toHaveLength(4);
    expect(POSES.run.frames).toHaveLength(4);
  });

  it("lays the frames side by side in one strip, one path per colour", () => {
    const s = spriteSvg([["#.", ".e"], ["##", "ee"]]);
    expect(s).toMatchObject({ w: 2, h: 2, n: 2 });
    expect(s.html).toContain('viewBox="0 0 4 2"');
    expect(s.html).toContain(`width="${4 * PX}" height="${2 * PX}"`);
    expect(s.html.match(/<path/g)).toHaveLength(2);
    expect(s.html.match(/h1v1h-1z/g)).toHaveLength(6);
  });
});

describe("the yarn ball", () => {
  const ball = (b: Partial<Ball>): Ball => ({ x: 100, y: 0, vx: 0, vy: 0, angle: 0, ...b });

  it("falls and bounces lower each time, then rests on the ground", () => {
    const b = ball({ y: 60 });
    let peaks = 0;
    let lastVy = 0;
    for (let i = 0; i < 400; i++) {
      stepBall(b, 1 / 60, 600, 120);
      if (lastVy > 0 && b.vy <= 0) peaks++;
      lastVy = b.vy;
      expect(b.y).toBeGreaterThanOrEqual(0);
    }
    expect(peaks).toBeGreaterThan(0);
    expect(ballResting(b)).toBe(true);
  });

  it("bounces off a wall slower, and reports a hard hit", () => {
    const b = ball({ x: 590, y: 50, vx: 900 }); // in the air: no rolling friction
    const hit = stepBall(b, 1 / 60, 600, 120);
    expect(b.x).toBe(600 - BALL_R);
    expect(b.vx).toBeCloseTo(-540);
    expect(hit.wall).toBe(900);
    expect(stepBall(ball({ x: 15, vx: -300 }), 1 / 60, 600, 120).wall).toBeUndefined();
  });

  it("slows down and stops when it rolls on the ground", () => {
    const b = ball({ vx: 200 });
    for (let i = 0; i < 300; i++) stepBall(b, 1 / 60, 10_000, 120);
    expect(ballResting(b)).toBe(true);
    expect(b.vx).toBe(0);
    expect(b.x).toBeGreaterThan(100);
  });

  it("turns as it rolls", () => {
    const b = ball({ vx: 120 });
    stepBall(b, 1 / 60, 600, 120);
    expect(b.angle).toBeGreaterThan(0);
  });
});
