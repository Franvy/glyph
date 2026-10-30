// Interface sounds (cuelume, played in src/components/sound.astro). Pure helpers, so Vitest can pin them.

/** localStorage key. Sound is on unless it holds "off". */
export const SOUND_KEY = "sound";

export function soundOn(stored: string | null): boolean {
  return stored !== "off";
}

export type Cue = "tap" | "navigate" | "toggle";

/** What the click handler sees of an element. */
export interface CueTarget {
  tag: string;
  href?: string | null;
  /** aria-pressed, if the element has it. */
  pressed?: string | null;
  download?: boolean;
}

/** The cue for a link or button that carries no data-cuelume-* attribute of its own. */
export function cueFor(target: CueTarget, page: URL): Cue | null {
  const tag = target.tag.toLowerCase();
  if (tag === "button") return target.pressed === "true" || target.pressed === "false" ? "toggle" : "tap";
  if (tag !== "a" || !target.href) return null;
  let url: URL;
  try {
    url = new URL(target.href, page);
  } catch {
    return null;
  }
  // A link inside the site moves the reader; mailto:, other sites and downloads only act.
  return url.origin === page.origin && !target.download ? "navigate" : "tap";
}

/** A throttle: true for the first call, then false until gapMs has passed. */
export function gate(gapMs: number): (now: number) => boolean {
  let last = -Infinity;
  return (now) => {
    if (now - last < gapMs) return false;
    last = now;
    return true;
  };
}
