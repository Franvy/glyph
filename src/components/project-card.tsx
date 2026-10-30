import { Globe } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { type Project, projectLink } from "@/lib/content";
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
    const sync = () => (still.matches ? el.pause() : el.play().catch(() => {}));
    sync();
    still.addEventListener("change", sync);
    return () => still.removeEventListener("change", sync);
  }, []);

  const className = "project-media size-full object-cover object-top";
  return media.kind === "video" ? (
    <video ref={video} className={className} src={mediaUrl(media.key)} aria-label={media.alt} muted loop playsInline preload="metadata" />
  ) : (
    <img className={className} src={mediaUrl(media.key)} alt={media.alt} loading="lazy" decoding="async" />
  );
}

/** Lucide's github mark (lucide-react has no brand icons). */
function GithubMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

/**
 * rinkitadhana.com project card: a framed preview, then name, status and blurb; under them a mark for each link,
 * the website (a globe) and GitHub. A project can have one or both.
 * The preview shows the uploaded image or video on a screen. Without one it shows the project's drawing (children,
 * from components/project-figure.astro), else the ascii art.
 */
export function ProjectCard({ project, figure = false, children }: { project: Project; figure?: boolean; children?: ReactNode }) {
  const drawing = figure && !project.media;
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
      <a href={projectLink(project)} onPointerEnter={scramble} className="flex flex-col gap-2">
        <div className="border border-edge p-1">
          <div className="project-shot relative h-50 overflow-hidden border border-line bg-tint max-sm:aspect-[311/200] max-sm:h-auto">
            {drawing && children}
            {/* A picture fills the screen edge to edge; text keeps a gutter. */}
            {!drawing && (
              <div
                className={`project-screen absolute inset-x-[10%] bottom-0 flex h-3/4 items-center justify-center overflow-hidden border border-b-0 border-line bg-bg ${project.media ? "" : "px-2"}`}
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
        <div className="flex flex-col gap-1 px-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 truncate text-base leading-5 font-semibold text-ink" aria-label={project.name}>
              <span aria-hidden>{name}</span>
            </h3>
            <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-dim">
              <span className="status-dot" data-status={project.status} style={{ "--blink-at": blinkAt(project.name) } as CSSProperties} aria-hidden />
              {STATUS[project.status]}
            </span>
          </div>
          <p className="font-sans text-sm leading-[22px] text-dim">{project.description}</p>
        </div>
      </a>
      <div className="flex items-center gap-3 px-2 pt-1">
        {project.site && (
          <a href={project.site} aria-label="Website" className="project-link flex h-5 items-center text-mute">
            <Globe size={14} aria-hidden />
          </a>
        )}
        {project.github && (
          <a href={project.github} aria-label="GitHub" className="project-link flex h-5 items-center text-mute">
            <GithubMark />
          </a>
        )}
        {!projectLink(project) && (
          <span role="img" aria-label="GitHub: not public yet" title="Source not public yet" className="flex h-5 items-center text-mute opacity-45">
            <GithubMark />
          </span>
        )}
      </div>
    </li>
  );
}
