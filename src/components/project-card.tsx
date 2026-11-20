import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/content";
import { mediaUrl } from "@/lib/media";
import { scrambleFrame } from "@/lib/scramble";

const DURATION = 300;

const STATUS: Record<Project["status"], string> = { live: "Live", beta: "Beta", dev: "Dev" };

/** A fixed offset into the live light's 7s blink, from the name, so two live cards do not blink together. */
const blinkAt = (name: string) => `-${[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 70 / 10}s`;

/** The uploaded image or video, cropped to the top of the screen. Videos loop silently, and hold still on request. */
function Media({ media }: { media: NonNullable<Project["media"]> }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    const sync = () => {
      if (still.matches || !visible || document.hidden) el.pause();
      else el.play().catch(() => {});
    };
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    seen.observe(el);
    still.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      seen.disconnect();
      still.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const className = "project-media size-full object-cover object-top";
  return media.kind === "video" ? (
    <video ref={video} className={className} src={mediaUrl(media.key)} aria-label={media.alt} muted loop playsInline preload="metadata" />
  ) : (
    <img className={className} src={mediaUrl(media.key)} alt={media.alt} loading="lazy" decoding="async" />
  );
}

/**
 * Project card: a framed preview, then a single row with name (linked to site or GitHub) and status bars.
 * The preview shows the uploaded image or video on a screen. Without one it shows the project's drawing (children,
 * from components/project-figure.astro), else the ascii art.
 */
export function ProjectCard({ project, figure = false, children }: { project: Project; figure?: boolean; children?: ReactNode }) {
  const drawing = figure && !project.media;
  const href = project.site ?? project.github;
  const [name, setName] = useState(project.name);
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Runs once per hover: glyphs resolve left to right in 300ms.
  function scramble() {
    if (window.matchMedia("(prefers-reduced-motion: reduce), (hover: none)").matches) return;
    cancelAnimationFrame(frame.current);
    const start = performance.now();
    const step = (now: number) => {
      const progress = (now - start) / DURATION;
      setName(progress >= 1 ? project.name : scrambleFrame(project.name, progress));
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }

  return (
    <li className="project p-3 max-sm:p-4">
      {/* A dev project with no link yet keeps the <a> (and its hover) without an href: it goes nowhere. */}
      <a href={href} onPointerEnter={scramble} className="flex flex-col gap-2.5">
        <div className="border border-edge p-1">
          <div className="project-shot relative h-50 overflow-hidden border border-line bg-tint max-sm:aspect-[311/200] max-sm:h-auto">
            {drawing && children}
            {/* C1 · Pure Framed Image (Paper: 240×174 inside 311×200): media fills edge to edge; text keeps a gutter. */}
            {!drawing && (
              <div
                className={`project-screen absolute inset-x-[11.2%] bottom-0 flex h-[87%] items-center justify-center overflow-hidden border border-b-0 border-[var(--cta-edge)] bg-bg ${project.media ? "" : "px-2"}`}
              >
                {project.media ? (
                  <Media media={project.media} />
                ) : project.art ? (
                  <pre className="project-art text-[10px] leading-3 whitespace-pre text-dim max-sm:text-[11px] max-sm:leading-[14px]" aria-hidden>
                    {project.art}
                  </pre>
                ) : (
                  <span className="project-empty text-xs whitespace-nowrap text-mute max-sm:text-[11px]" aria-hidden>
                    [ no preview ]
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="project-name min-w-0 truncate text-base leading-5 font-semibold text-ink" aria-label={project.name}>
            <span aria-hidden>{name}</span>
          </h3>
          <span
            className="status flex shrink-0 items-center gap-[7px] text-[11px] leading-none font-medium tracking-[0.08em] uppercase"
            data-status={project.status}
            style={{ "--blink-at": blinkAt(project.name) } as CSSProperties}
          >
            <span className="status-bars" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            {STATUS[project.status]}
          </span>
        </div>
      </a>
    </li>
  );
}
