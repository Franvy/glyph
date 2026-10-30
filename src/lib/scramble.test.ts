import { describe, expect, it } from "vitest";
import { SCRAMBLE_GLYPHS, scrambleFrame } from "./scramble";

describe("scrambleFrame", () => {
  it("shows only glyphs at the start", () => {
    const frame = scrambleFrame("BoardUI", 0, () => 0);
    expect(frame).toBe(SCRAMBLE_GLYPHS[0].repeat(7));
  });

  it("resolves left to right as progress grows", () => {
    expect(scrambleFrame("BoardUI", 3 / 7, () => 0)).toBe(`Boa${SCRAMBLE_GLYPHS[0].repeat(4)}`);
  });

  it("returns the target once finished, and clamps overshoot", () => {
    expect(scrambleFrame("limns.cc", 1)).toBe("limns.cc");
    expect(scrambleFrame("limns.cc", 1.4)).toBe("limns.cc");
  });

  it("keeps spaces and length intact", () => {
    const frame = scrambleFrame("pay sandbox", 0.2, () => 0.99);
    expect(frame).toHaveLength(11);
    expect(frame[3]).toBe(" ");
  });

  it("never picks outside the glyph set, even when random returns 1", () => {
    const frame = scrambleFrame("abc", 0, () => 1);
    for (const char of frame) expect(SCRAMBLE_GLYPHS).toContain(char);
  });
});
