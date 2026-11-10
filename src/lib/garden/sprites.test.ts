import { expect, it } from "vitest";
import { PALETTES } from "./palette";
import { RAIN_UMBRELLA } from "./sprites";

it("matches the Paper umbrella silhouette, handle and colors", () => {
  const pixels = new Map(RAIN_UMBRELLA.map(([x, y, key]) => [`${x},${y}`, PALETTES.light[key]]));
  const row = (y: number) => Array.from({ length: 19 }, (_, i) => pixels.get(`${i + 4},${y}`) ?? ".");
  expect(row(2)).toEqual([...Array(5).fill("."), ...Array(9).fill("#E7BE68"), ...Array(5).fill(".")]);
  expect(row(7)).toEqual([
    "#E7BE68", "#E7BE68", "#D2A657", "#D2A657", "#E7BE68", "#E7BE68", "#E7BE68",
    "#D2A657", "#D2A657", "#E7BE68", "#E7BE68", "#E7BE68", "#E7BE68", "#D2A657",
    "#D2A657", "#E7BE68", "#E7BE68", "#E7BE68", "#E7BE68",
  ]);
  expect(pixels.get("13,1")).toBe("#B28D6E");
  expect(pixels.get("13,3")).toBe("#F6DA99");
  expect(row(19).slice(7, 10)).toEqual(Array(3).fill("#B28D6E"));
});
