import { play } from "cuelume";
import { useEffect, useRef, useState } from "react";

const IDLE = "copy";
const DONE = "copied ✓";

/** Swaps one label for another a character at a time, left to right. */
function wipe(from: string, to: string, step: number) {
  return to.slice(0, step) + from.slice(step);
}

export function CopyEmail({ email }: { email: string }) {
  const [label, setLabel] = useState(IDLE);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  function animate(from: string, to: string, startAt: number) {
    const width = Math.max(from.length, to.length);
    for (let step = 1; step <= width; step++) {
      timers.current.push(window.setTimeout(() => setLabel(wipe(from, to, step)), startAt + step * 28));
    }
    return startAt + width * 28;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      play("error");
      return;
    }
    play("success");
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    const shown = animate(label, DONE, 0);
    animate(DONE, IDLE, shown + 1200);
  }

  return (
    <span className="flex items-center gap-2.5">
      <a href={`mailto:${email}`} className="link">
        {email}
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${email}`}
        className="press min-w-[9ch] whitespace-pre border border-dashed border-edge px-1.5 text-xs leading-[18px] text-mute"
      >
        {label}
      </button>
      <span className="sr-only" aria-live="polite">
        {label === DONE ? "Email copied" : ""}
      </span>
    </span>
  );
}
