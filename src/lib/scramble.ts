export const SCRAMBLE_GLYPHS = "#/%@&*+=?";

/**
 * One frame of a left-to-right text scramble. Characters before the
 * `progress` cursor show the target; the rest show a random glyph.
 * Spaces stay spaces so the word shape holds while it resolves.
 */
export function scrambleFrame(target: string, progress: number, random: () => number = Math.random): string {
  const resolved = Math.floor(Math.min(Math.max(progress, 0), 1) * target.length);
  let out = "";
  for (let i = 0; i < target.length; i++) {
    const char = target[i];
    if (i < resolved || char === " ") out += char;
    else out += SCRAMBLE_GLYPHS[Math.floor(random() * SCRAMBLE_GLYPHS.length) % SCRAMBLE_GLYPHS.length];
  }
  return out;
}
