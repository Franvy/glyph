import { Eye, Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Counters } from "@/lib/counters";
import { PX, POSES, spriteSvg } from "@/lib/meiqiu";
import { mountMeiqiu } from "./meiqiu-engine";

declare global {
  interface Window {
    /** Set by Base.astro: the page-view POST, which answers with both totals. */
    __glyphCounts?: Promise<Counters | null>;
  }
}

// Drawn on the server so the cat is already asleep before the island wakes up.
const SLEEPING = spriteSvg([POSES.sleep.frames[0]]);
const MAX_BATCH = 50; // CounterInput's limit
const fmt = (n: number | undefined) => (n === undefined ? "--" : n.toLocaleString("en-US"));

function post(body: object) {
  return fetch("/api/counters", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => (r.ok ? (r.json() as Promise<Counters>) : null));
}

type Props = { year: number; owner: string; repo: string };

/** The footer: Meiqiu and its yarn ball, then the copyright, the site totals and the source. */
export function Meiqiu({ year, owner, repo }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const heart = useRef<HTMLSpanElement>(null);
  const pending = useRef(0); // pets not yet sent
  const [counts, setCounts] = useState<Counters>();

  // Totals from the server, plus the pets still on their way.
  const take = (c: Counters | null) => {
    if (c) setCounts({ ...c, pets: c.pets + pending.current });
  };

  useEffect(() => {
    const area = root.current;
    const s = stage.current;
    if (!area || !s) return;
    const onPet = () => {
      pending.current++;
      setCounts((c) => c && { ...c, pets: c.pets + 1 });
      const h = heart.current;
      if (h) {
        h.classList.remove("mq-beat");
        void h.offsetWidth;
        h.classList.add("mq-beat");
      }
    };
    return mountMeiqiu({ area, stage: s, onPet });
  }, []);

  useEffect(() => {
    (window.__glyphCounts ?? fetch("/api/counters").then((r) => (r.ok ? r.json() : null)))
      .then(take)
      .catch(() => {});

    const flush = () => {
      const by = Math.min(pending.current, MAX_BATCH);
      if (!by) return;
      pending.current -= by;
      post({ name: "pets", by })
        .then(take)
        .catch(() => (pending.current += by)); // try again with the next batch
    };
    const timer = window.setInterval(flush, 2000);
    // leaving: send what is left, even as the page unloads
    const leave = () => {
      const by = Math.min(pending.current, MAX_BATCH);
      if (!by) return;
      pending.current -= by;
      navigator.sendBeacon("/api/counters", new Blob([JSON.stringify({ name: "pets", by })], { type: "application/json" }));
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  return (
    <div ref={root} className="mq">
      <div ref={stage} className="mq-stage" data-testid="meiqiu-stage" data-live>
        <span
          data-ssr
          className="mq-ssr"
          style={{ left: 60 - (SLEEPING.w * PX) / 2 }}
          dangerouslySetInnerHTML={{ __html: SLEEPING.html }}
        />
      </div>
      <div className="mq-foot">
        <span>
          © {year} {owner}
        </span>
        <span className="mq-totals tabular-nums">
          <span className="mq-total" title="Page views">
            <Eye size={14} aria-hidden="true" />
            <span className="sr-only">Page views</span>
            <span data-testid="site-views">{fmt(counts?.views)}</span>
          </span>
          <span className="mq-total" title="Times Meiqiu was petted">
            <span ref={heart} className="mq-heart">
              <Heart size={14} aria-hidden="true" />
            </span>
            <span className="sr-only">Times Meiqiu was petted</span>
            <span data-testid="meiqiu-pets">{fmt(counts?.pets)}</span>
          </span>
        </span>
        <a href={repo} className="mq-src" aria-label="Source on GitHub" title="Source on GitHub">
          {/* Lucide 1.x dropped brand icons: the last Lucide drawing (0.577), as in brand-icon.astro. */}
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
        </a>
      </div>
    </div>
  );
}
