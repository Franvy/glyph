import { useCallback, useEffect, useRef, useState } from "react";
import type { SectionName, SiteContent } from "@/lib/content";
import { SCENE_LABELS, SCENES } from "@/lib/garden/themes";
import { mediaUrl } from "@/lib/media";
import { SKILL_MARKS } from "@/lib/skill-marks";
import { cleanSvg } from "@/lib/svg";
import { BannerPreview } from "./shaders";

type Status = { kind: "idle" | "saving" | "saved" | "error"; text?: string };
type Project = SiteContent["projects"][number];
type Snapshot = SiteContent["snapshots"][number];
type Skill = SiteContent["skills"][number];

const SECTIONS: { id: SectionName; label: string; hidden?: boolean }[] = [
  { id: "banner", label: "Banner" },
  { id: "profile", label: "Profile" },
  { id: "projects", label: "Projects" },
  { id: "skills", label: "Skills" },
  { id: "now", label: "Now", hidden: true },
  { id: "snapshots", label: "Snapshots", hidden: true },
];

const field = "w-full border border-edge bg-card px-2 py-1.5 text-sm leading-5 text-ink outline-none focus:border-accent";
const btn = "press border border-edge px-2 py-1 text-[13px] leading-5 text-body hover:text-ink disabled:opacity-40";
const iconBtn = "press border border-edge px-1.5 py-0.5 text-[12px] leading-5 text-dim hover:text-ink disabled:opacity-30";

const toLines = (s: string) => s.split("\n");
const fromLines = (list: string[]) => list.join("\n");

function initialTab(): SectionName {
  if (typeof window === "undefined") return "banner";
  const hash = window.location.hash.slice(1) as SectionName;
  return SECTIONS.some((s) => s.id === hash) ? hash : "banner";
}

function Label({ text, className = "", children }: { text: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 text-[12px] leading-4 text-dim ${className}`}>
      {text}
      {children}
    </label>
  );
}

/** Tracks which list indices are expanded, keeping them aligned across moves and deletes. */
function useOpenSet() {
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  return {
    has: (i: number) => open.has(i),
    toggle: (i: number) =>
      setOpen((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        return next;
      }),
    openOnly: (i: number) => setOpen(new Set([i])),
    onMove: (i: number, by: -1 | 1) =>
      setOpen((prev) => {
        const j = i + by;
        const a = prev.has(i);
        const b = prev.has(j);
        if (a === b) return prev;
        const next = new Set(prev);
        if (a) next.add(j);
        else next.delete(j);
        if (b) next.add(i);
        else next.delete(i);
        return next;
      }),
    onRemove: (i: number) =>
      setOpen((prev) => {
        const next = new Set<number>();
        for (const k of prev) {
          if (k < i) next.add(k);
          else if (k > i) next.add(k - 1);
        }
        return next;
      }),
    clear: () => setOpen(new Set()),
  };
}

/** Move, remove and add for a list of items, keeping an open-index set in sync. */
function useList<T>(list: T[], set: (next: T[]) => void, open: ReturnType<typeof useOpenSet>) {
  return {
    update: (i: number, patch: Partial<T>) => set(list.map((item, j) => (j === i ? { ...item, ...patch } : item))),
    remove: (i: number) => {
      open.onRemove(i);
      set(list.filter((_, j) => j !== i));
    },
    move: (i: number, by: -1 | 1) => {
      const next = [...list];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      open.onMove(i, by);
      set(next);
    },
    add: (item: T) => {
      const idx = list.length;
      set([...list, item]);
      open.openOnly(idx);
    },
  };
}

function RowActions({
  i,
  count,
  onMove,
  onRemove,
}: {
  i: number;
  count: number;
  onMove: (i: number, by: -1 | 1) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button type="button" className={iconBtn} disabled={i === 0} onClick={() => onMove(i, -1)} aria-label="Move up">
        ↑
      </button>
      <button type="button" className={iconBtn} disabled={i === count - 1} onClick={() => onMove(i, 1)} aria-label="Move down">
        ↓
      </button>
      <button type="button" className={`${iconBtn} hover:text-[#f87171]`} onClick={() => onRemove(i)} aria-label="Delete">
        ×
      </button>
    </div>
  );
}

type Uploaded = { key: string; kind: "image" | "video" };

/** Sends one file to /api/admin/media and hands back its key. The server checks the type and size again. */
function Upload({
  slot,
  label,
  accept,
  onDone,
}: {
  slot: "project" | "icon";
  label: string;
  accept: string;
  onDone: (file: Uploaded) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });

  async function send(file: File) {
    setState({ busy: true });
    const form = new FormData();
    form.set("file", file);
    form.set("slot", slot);
    try {
      const res = await fetch("/api/admin/media", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as (Uploaded & { error?: string }) | null;
      if (!res.ok || !body?.key) {
        setState({ busy: false, error: body?.error ?? `Upload failed (${res.status}). Try again.` });
        return;
      }
      setState({ busy: false });
      onDone({ key: body.key, kind: body.kind });
    } catch {
      setState({ busy: false, error: "Network error. Check your connection and try again." });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="contents">
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) send(file);
        }}
      />
      <button type="button" className={btn} disabled={state.busy} onClick={() => input.current?.click()}>
        {state.busy ? "Uploading…" : label}
      </button>
      {state.error && (
        <span role="alert" className="basis-full text-[12px] leading-4 text-[#f87171]">
          {state.error}
        </span>
      )}
    </div>
  );
}

export function AdminEditor({ initial }: { initial: SiteContent }) {
  const [active, setActive] = useState<SectionName>(initialTab);
  const [content, setContent] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<Partial<Record<SectionName, Status>>>({});

  const openProjects = useOpenSet();
  const openSkills = useOpenSet();
  const openSnapshots = useOpenSet();

  const dirty = useCallback(
    (id: SectionName) => JSON.stringify(content[id]) !== JSON.stringify(saved[id]),
    [content, saved],
  );
  const anyDirty = SECTIONS.some((s) => dirty(s.id));

  const switchTab = (id: SectionName) => {
    setActive(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  };

  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const set = <S extends SectionName>(id: S, data: SiteContent[S]) => {
    setContent((c) => ({ ...c, [id]: data }));
    setStatus((s) => ({ ...s, [id]: { kind: "idle" } }));
  };

  const reset = (id: SectionName) => {
    setContent((c) => ({ ...c, [id]: saved[id] }));
    setStatus((s) => ({ ...s, [id]: { kind: "idle" } }));
    if (id === "projects") openProjects.clear();
    if (id === "skills") openSkills.clear();
    if (id === "snapshots") openSnapshots.clear();
  };

  const save = useCallback(
    async (id: SectionName) => {
      setStatus((s) => ({ ...s, [id]: { kind: "saving" } }));
      try {
        const res = await fetch("/api/admin/content", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ section: id, data: content[id] }),
        });
        const body = (await res.json().catch(() => null)) as { data?: unknown; error?: string } | null;
        if (!res.ok || !body?.data) {
          setStatus((s) => ({ ...s, [id]: { kind: "error", text: body?.error ?? `Save failed (${res.status}). Try again.` } }));
          return;
        }
        // The server trims and drops blank lines: show what was stored.
        setContent((c) => ({ ...c, [id]: body.data }));
        setSaved((c) => ({ ...c, [id]: body.data }));
        setStatus((s) => ({ ...s, [id]: { kind: "saved", text: "Saved" } }));
      } catch {
        setStatus((s) => ({ ...s, [id]: { kind: "error", text: "Network error. Check your connection and try again." } }));
      }
    },
    [content],
  );

  // Cmd+S / Ctrl+S saves the active tab.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty(active) && status[active]?.kind !== "saving") {
          void save(active);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, dirty, save, status]);

  const counts: Partial<Record<SectionName, number>> = {
    projects: content.projects.length,
    skills: content.skills.length,
    snapshots: content.snapshots.length,
  };

  const profile = content.profile;
  const setProfile = (patch: Partial<typeof profile>) => set("profile", { ...profile, ...patch });
  const projects = useList(content.projects, (next) => set("projects", next), openProjects);
  const snapshots = useList(content.snapshots, (next) => set("snapshots", next), openSnapshots);
  const skills = useList(content.skills, (next) => set("skills", next), openSkills);

  const st = status[active] ?? { kind: "idle" };
  const isDirty = dirty(active);
  const currentMeta = SECTIONS.find((s) => s.id === active)!;

  const body: Record<SectionName, React.ReactNode> = {
    banner: (
      <div className="flex flex-col gap-3">
        <div className="border border-edge p-1">
          <BannerPreview scene={content.banner.scene} />
        </div>
        <div role="radiogroup" aria-label="Banner theme" className="grid grid-cols-3 gap-1.5 max-sm:grid-cols-2">
          {SCENES.map((scene) => {
            const on = content.banner.scene === scene;
            return (
              <button
                key={scene}
                type="button"
                role="radio"
                aria-checked={on}
                className={`press flex items-center justify-between gap-2 border px-2.5 py-1.5 text-left text-[13px] leading-5 ${
                  on ? "border-accent bg-card-hi text-ink" : "border-edge bg-card text-body hover:text-ink"
                }`}
                onClick={() => set("banner", { scene })}
              >
                <span className="truncate">{SCENE_LABELS[scene]}</span>
                <span aria-hidden className={`shrink-0 ${on ? "text-accent" : "text-mute"}`}>
                  {on ? "[x]" : "[ ]"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    ),

    profile: (
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Label text="Name">
          <input className={field} value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
        </Label>
        <Label text="Headline">
          <input className={field} value={profile.headline} onChange={(e) => setProfile({ headline: e.target.value })} />
        </Label>
        <Label text="Email">
          <input className={field} type="email" value={profile.email} onChange={(e) => setProfile({ email: e.target.value })} />
        </Label>
        <Label text="Time zone">
          <input
            className={field}
            placeholder="Asia/Shanghai"
            value={profile.timeZone}
            onChange={(e) => setProfile({ timeZone: e.target.value })}
          />
        </Label>
        <Label text="City">
          <input className={field} value={profile.city} onChange={(e) => setProfile({ city: e.target.value })} />
        </Label>
        <Label text="Country">
          <input className={field} value={profile.country} onChange={(e) => setProfile({ country: e.target.value })} />
        </Label>
        <Label text="GitHub">
          <input className={field} type="url" value={profile.github} onChange={(e) => setProfile({ github: e.target.value })} />
        </Label>
        <Label text="X">
          <input className={field} type="url" value={profile.x} onChange={(e) => setProfile({ x: e.target.value })} />
        </Label>
        <Label text="Duolingo">
          <input
            className={field}
            placeholder="Optional"
            value={profile.duolingo ?? ""}
            onChange={(e) => setProfile({ duolingo: e.target.value })}
          />
        </Label>
        <Label text="Booking">
          <input
            className={field}
            type="url"
            placeholder="https://cal.com/…"
            value={profile.booking ?? ""}
            onChange={(e) => setProfile({ booking: e.target.value })}
          />
        </Label>
        <Label text="Repo" className="col-span-2 max-sm:col-span-1">
          <input className={field} type="url" value={profile.repo} onChange={(e) => setProfile({ repo: e.target.value })} />
        </Label>
        <Label text="Roles" className="col-span-2 max-sm:col-span-1">
          <textarea
            className={field}
            rows={3}
            placeholder="One per line"
            value={fromLines(profile.roles)}
            onChange={(e) => setProfile({ roles: toLines(e.target.value) })}
          />
        </Label>
      </div>
    ),

    projects: (
      <div className="flex flex-col gap-2">
        {content.projects.map((p: Project, i) => {
          const expanded = openProjects.has(i);
          return (
            <div key={i} className="border border-edge bg-card">
              <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => openProjects.toggle(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openProjects.toggle(i);
                  }
                }}
                className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-card-hi"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span aria-hidden className="text-[12px] text-mute">
                    {expanded ? "▾" : "▸"}
                  </span>
                  <span className="text-[12px] text-mute">#{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate font-medium text-ink">{p.name.trim() || "Untitled"}</span>
                  <span className="border border-line px-1.5 text-[11px] leading-4 text-dim">{p.status}</span>
                  {p.media && <span className="text-[11px] text-mute">{p.media.kind}</span>}
                </div>
                <RowActions i={i} count={content.projects.length} onMove={projects.move} onRemove={projects.remove} />
              </div>

              {expanded && (
                <div className="flex flex-col gap-3 border-t border-dashed border-edge p-3">
                  <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                    <Label text="Name">
                      <input className={field} value={p.name} onChange={(e) => projects.update(i, { name: e.target.value })} />
                    </Label>
                    <Label text="Status">
                      <select
                        className={field}
                        value={p.status}
                        onChange={(e) => projects.update(i, { status: e.target.value as Project["status"] })}
                      >
                        <option value="live">live</option>
                        <option value="beta">beta</option>
                        <option value="dev">dev</option>
                      </select>
                    </Label>
                    <Label text="Website">
                      <input
                        className={field}
                        type="url"
                        placeholder="https://"
                        value={p.site ?? ""}
                        onChange={(e) => projects.update(i, { site: e.target.value })}
                      />
                    </Label>
                    <Label text="GitHub">
                      <input
                        className={field}
                        type="url"
                        placeholder="https://github.com/…"
                        value={p.github ?? ""}
                        onChange={(e) => projects.update(i, { github: e.target.value })}
                      />
                    </Label>
                  </div>

                  <Label text="Description">
                    <textarea
                      className={field}
                      rows={2}
                      value={p.description}
                      onChange={(e) => projects.update(i, { description: e.target.value })}
                    />
                  </Label>

                  <div className="flex flex-col gap-2">
                    <span className="text-[12px] leading-4 text-dim">Media</span>
                    {p.media ? (
                      <div className="flex items-start gap-3 max-sm:flex-col">
                        <div className="h-20 w-32 shrink-0 overflow-hidden border border-line bg-tint">
                          {p.media.kind === "video" ? (
                            <video className="size-full object-cover object-top" src={mediaUrl(p.media.key)} muted loop playsInline />
                          ) : (
                            <img className="size-full object-cover object-top" src={mediaUrl(p.media.key)} alt={p.media.alt} />
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-2 max-sm:w-full">
                          <Label text="Alt text">
                            <input
                              className={field}
                              value={p.media.alt}
                              onChange={(e) => projects.update(i, { media: { ...p.media!, alt: e.target.value } })}
                            />
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            <Upload
                              slot="project"
                              label="Replace"
                              accept="image/png,image/jpeg,image/gif,image/webp,image/avif,video/mp4,video/webm"
                              onDone={(file) => projects.update(i, { media: { ...file, alt: p.media?.alt ?? "" } })}
                            />
                            <button type="button" className={btn} onClick={() => projects.update(i, { media: undefined })}>
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Upload
                          slot="project"
                          label="Upload image / video"
                          accept="image/png,image/jpeg,image/gif,image/webp,image/avif,video/mp4,video/webm"
                          onDone={(file) => projects.update(i, { media: { ...file, alt: p.media?.alt ?? "" } })}
                        />
                      </div>
                    )}
                  </div>

                  <Label text="Preview label">
                    <input className={field} value={p.shot} onChange={(e) => projects.update(i, { shot: e.target.value })} />
                  </Label>

                  {p.media ? (
                    <details className="text-[12px] text-dim">
                      <summary className="cursor-pointer select-none py-1 hover:text-ink">ASCII fallback</summary>
                      <textarea
                        className={`${field} mt-1 whitespace-pre`}
                        rows={6}
                        wrap="off"
                        spellCheck={false}
                        aria-label="ASCII fallback"
                        value={p.art ?? ""}
                        onChange={(e) => projects.update(i, { art: e.target.value })}
                      />
                    </details>
                  ) : (
                    <Label text="ASCII fallback">
                      <textarea
                        className={`${field} whitespace-pre`}
                        rows={6}
                        wrap="off"
                        spellCheck={false}
                        value={p.art ?? ""}
                        onChange={(e) => projects.update(i, { art: e.target.value })}
                      />
                    </Label>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div className="pt-1">
          <button
            type="button"
            className={btn}
            onClick={() => projects.add({ name: "", status: "live", description: "", site: "", github: "", shot: "Preview" })}
          >
            + Add project
          </button>
        </div>
      </div>
    ),

    skills: (
      <div className="flex flex-col gap-1.5">
        {content.skills.map((sk: Skill, i) => {
          const check = sk.svg?.trim() ? cleanSvg(sk.svg) : null;
          const builtIn = SKILL_MARKS[sk.name.trim()];
          const svgInvalid = Boolean(check && !check.ok);
          const svgOpen = openSkills.has(i) || svgInvalid;

          return (
            <div key={i} className="flex flex-col gap-1.5 border border-edge bg-card p-1.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="flex size-7 shrink-0 items-center justify-center border border-line bg-tint text-mute"
                  {...(check?.ok
                    ? { dangerouslySetInnerHTML: { __html: check.svg } }
                    : { children: <span className={`text-[11px] ${svgInvalid ? "text-[#f87171]" : "text-mute"}`}>{svgInvalid ? "!" : "—"}</span> })}
                />
                <input
                  className={`${field} w-auto min-w-0 flex-1 py-1`}
                  aria-label={`Name of skill ${i + 1}`}
                  placeholder="Skill name"
                  value={sk.name}
                  onChange={(e) => skills.update(i, { name: e.target.value })}
                />
                {builtIn && !sk.svg?.trim() && (
                  <button
                    type="button"
                    className={`${iconBtn} text-accent`}
                    onClick={() => skills.update(i, { svg: builtIn })}
                  >
                    Built-in
                  </button>
                )}
                <button
                  type="button"
                  className={`${iconBtn} ${svgOpen ? "border-accent text-ink" : ""} ${svgInvalid ? "text-[#f87171]" : ""}`}
                  aria-expanded={svgOpen}
                  onClick={() => openSkills.toggle(i)}
                >
                  {svgInvalid ? "SVG !" : check?.ok ? "SVG" : "+ SVG"}
                </button>
                <RowActions i={i} count={content.skills.length} onMove={skills.move} onRemove={skills.remove} />
              </div>

              {svgOpen && (
                <div className="flex flex-col gap-1">
                  <textarea
                    className={`${field} h-16 resize-y font-mono text-[12px] leading-4`}
                    aria-label={`SVG code of skill ${i + 1}`}
                    placeholder="<svg viewBox=…>…</svg>"
                    spellCheck={false}
                    value={sk.svg ?? ""}
                    onChange={(e) => skills.update(i, { svg: e.target.value })}
                  />
                  {check && !check.ok && (
                    <p role="alert" className="text-[12px] leading-4 text-[#f87171]">
                      {check.error}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div className="pt-1">
          <button type="button" className={btn} onClick={() => skills.add({ name: "" })}>
            + Add skill
          </button>
        </div>
      </div>
    ),

    now: (
      <textarea
        className={`${field} whitespace-pre`}
        rows={6}
        wrap="off"
        aria-label="Now"
        placeholder="One item per line"
        value={fromLines(content.now)}
        onChange={(e) => set("now", toLines(e.target.value))}
      />
    ),

    snapshots: (
      <div className="flex flex-col gap-2">
        {content.snapshots.map((s: Snapshot, i) => {
          const expanded = openSnapshots.has(i);
          return (
            <div key={i} className="border border-edge bg-card">
              <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => openSnapshots.toggle(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openSnapshots.toggle(i);
                  }
                }}
                className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-card-hi"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span aria-hidden className="text-[12px] text-mute">
                    {expanded ? "▾" : "▸"}
                  </span>
                  <span className="text-[12px] text-mute">#{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate font-medium text-ink">{s.label.trim() || "Untitled"}</span>
                </div>
                <RowActions i={i} count={content.snapshots.length} onMove={snapshots.move} onRemove={snapshots.remove} />
              </div>

              {expanded && (
                <div className="flex flex-col gap-3 border-t border-dashed border-edge p-3">
                  <Label text="Title">
                    <input className={field} value={s.label} onChange={(e) => snapshots.update(i, { label: e.target.value })} />
                  </Label>
                  <Label text="ASCII art">
                    <textarea
                      className={`${field} whitespace-pre`}
                      rows={6}
                      wrap="off"
                      spellCheck={false}
                      value={s.art}
                      onChange={(e) => snapshots.update(i, { art: e.target.value })}
                    />
                  </Label>
                </div>
              )}
            </div>
          );
        })}
        <div className="pt-1">
          <button type="button" className={btn} onClick={() => snapshots.add({ label: "", art: "" })}>
            + Add snapshot
          </button>
        </div>
      </div>
    ),
  };

  return (
    <div className="flex flex-col">
      <nav aria-label="Sections" className="band sticky top-0 z-10 bg-bg">
        <div role="tablist" className="rail flex flex-wrap items-center gap-1 px-3 py-2">
          {SECTIONS.map(({ id, label }) => {
            const selected = active === id;
            const count = counts[id];
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={selected}
                aria-controls={`panel-${id}`}
                onClick={() => switchTab(id)}
                className={`press flex shrink-0 items-center gap-1.5 border px-2 py-1 text-[13px] leading-5 ${
                  selected
                    ? "border-accent bg-card-hi text-ink"
                    : "border-transparent text-dim hover:border-edge hover:text-body"
                }`}
              >
                <span>{label}</span>
                {count !== undefined && <span className="text-[11px] text-mute">{count}</span>}
                {dirty(id) && <span aria-label="Unsaved" className="size-1.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </nav>

      <section
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="band"
      >
        <form
          className="rail flex flex-col gap-3 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(active);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base leading-6 font-bold text-ink">{currentMeta.label}</h2>
              {currentMeta.hidden && (
                <span className="border border-line px-1.5 text-[11px] leading-4 text-mute">not on home</span>
              )}
              {st.text && (
                <span
                  role="status"
                  className={`text-[12px] leading-4 ${st.kind === "error" ? "text-[#f87171]" : "text-dim"}`}
                >
                  {st.text}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isDirty && (
                <button type="button" className={btn} onClick={() => reset(active)}>
                  Reset
                </button>
              )}
              <button
                type="submit"
                className="press bg-ink px-2.5 py-1 text-[13px] leading-5 font-medium text-bg disabled:opacity-40"
                disabled={st.kind === "saving" || !isDirty}
              >
                {st.kind === "saving" ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {body[active]}
        </form>
      </section>
    </div>
  );
}
