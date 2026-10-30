import { useEffect, useRef, useState } from "react";
import type { SectionName, SiteContent } from "@/lib/content";
import { mediaUrl } from "@/lib/media";
import { SKILL_MARKS } from "@/lib/skill-marks";
import { cleanSvg } from "@/lib/svg";
import { SCENE_LABELS, SCENES } from "@/lib/garden/themes";
import { BannerPreview } from "./shaders";

type Status = { kind: "idle" | "saving" | "saved" | "error"; text?: string };
type Project = SiteContent["projects"][number];
type Snapshot = SiteContent["snapshots"][number];
type Skill = SiteContent["skills"][number];

const SECTIONS: { id: SectionName; title: string; note?: string }[] = [
  {
    id: "banner",
    title: "Banner theme",
    note: "The theme of Meiqiu's garden at the top of the home page. The preview follows the light or dark theme of this page, and you can play with Meiqiu in it. Reload the home page after you save to see the change.",
  },
  { id: "profile", title: "Profile" },
  { id: "projects", title: "Projects" },
  {
    id: "skills",
    title: "Skills",
    note: "Paste the SVG code of each icon. The square shows the icon as the home page draws it. Every icon gets the same colour and size: its colours become the text colour (light parts of a two-tone icon become cut-outs), and it is fitted to a 14px square. Scripts, links and styles are removed or refused. Leave the code empty to show only the name.",
  },
  { id: "now", title: "Now", note: "One item per line. The home page does not show this section yet." },
  { id: "snapshots", title: "Snapshots", note: "The home page does not show this section yet." },
];

const field = "w-full border border-edge bg-card px-2 py-1.5 text-sm leading-5 text-ink outline-none focus:border-accent";
const button = "press border border-edge px-2 py-1 text-[13px] leading-5 text-body hover:text-ink disabled:opacity-40";

const toLines = (s: string) => s.split("\n");
const fromLines = (list: string[]) => list.join("\n");

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] leading-5 text-dim">
      {text}
      {children}
    </label>
  );
}

/** Move, remove and add for a list of cards. */
function useList<T>(list: T[], set: (next: T[]) => void) {
  return {
    update: (i: number, patch: Partial<T>) => set(list.map((item, j) => (j === i ? { ...item, ...patch } : item))),
    remove: (i: number) => set(list.filter((_, j) => j !== i)),
    move: (i: number, by: -1 | 1) => {
      const next = [...list];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      set(next);
    },
    add: (item: T) => set([...list, item]),
  };
}

function ItemBar({ i, count, list }: { i: number; count: number; list: ReturnType<typeof useList> }) {
  return (
    <div className="flex items-center justify-between text-[13px] text-mute">
      <span>#{String(i + 1).padStart(2, "0")}</span>
      <div className="flex gap-1.5">
        <button type="button" className={button} disabled={i === 0} onClick={() => list.move(i, -1)} aria-label="Move up">
          ↑
        </button>
        <button type="button" className={button} disabled={i === count - 1} onClick={() => list.move(i, 1)} aria-label="Move down">
          ↓
        </button>
        <button type="button" className={button} onClick={() => list.remove(i)}>
          Delete
        </button>
      </div>
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
  className = "flex flex-wrap items-center gap-2",
}: {
  slot: "project" | "icon";
  label: string;
  accept: string;
  onDone: (file: Uploaded) => void;
  /** "contents" puts the button and the error straight into the parent row. */
  className?: string;
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
        setState({ busy: false, error: body?.error ?? `Upload failed (${res.status}). Please try again later.` });
        return;
      }
      setState({ busy: false });
      onDone({ key: body.key, kind: body.kind });
    } catch {
      setState({ busy: false, error: "Network error. Nothing was uploaded. Check your connection and try again." });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={className}>
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
      <button type="button" className={button} disabled={state.busy} onClick={() => input.current?.click()}>
        {state.busy ? "Uploading…" : label}
      </button>
      {state.error && (
        <span role="alert" className="order-last basis-full text-[13px] leading-5 text-[#f87171]">
          {state.error}
        </span>
      )}
    </div>
  );
}

export function AdminEditor({ initial }: { initial: SiteContent }) {
  const [content, setContent] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<Partial<Record<SectionName, Status>>>({});

  const dirty = (id: SectionName) => JSON.stringify(content[id]) !== JSON.stringify(saved[id]);
  const anyDirty = SECTIONS.some((s) => dirty(s.id));

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

  async function save(id: SectionName) {
    setStatus((s) => ({ ...s, [id]: { kind: "saving" } }));
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section: id, data: content[id] }),
      });
      const body = (await res.json().catch(() => null)) as { data?: unknown; error?: string } | null;
      if (!res.ok || !body?.data) {
        setStatus((s) => ({ ...s, [id]: { kind: "error", text: body?.error ?? `Save failed (${res.status}). Please try again later.` } }));
        return;
      }
      // The server trims and drops blank lines: show what was stored.
      setContent((c) => ({ ...c, [id]: body.data }));
      setSaved((c) => ({ ...c, [id]: body.data }));
      setStatus((s) => ({ ...s, [id]: { kind: "saved", text: "Saved. Reload the home page to see it." } }));
    } catch {
      setStatus((s) => ({ ...s, [id]: { kind: "error", text: "Network error. Nothing was saved. Check your connection and try again." } }));
    }
  }

  const profile = content.profile;
  const setProfile = (patch: Partial<typeof profile>) => set("profile", { ...profile, ...patch });
  const projects = useList(content.projects, (next) => set("projects", next));
  const snapshots = useList(content.snapshots, (next) => set("snapshots", next));
  const skills = useList(content.skills, (next) => set("skills", next));

  const body: Record<SectionName, React.ReactNode> = {
    banner: (
      <div role="radiogroup" aria-label="Banner theme" className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        {SCENES.map((scene) => {
          const on = content.banner.scene === scene;
          return (
            <div key={scene} className={`flex flex-col border p-1.5 ${on ? "border-accent" : "border-edge"}`}>
              <BannerPreview scene={scene} />
              <button
                type="button"
                role="radio"
                aria-checked={on}
                className="press flex items-center justify-between gap-2 px-1 pt-1.5 text-left text-[13px] leading-5"
                onClick={() => set("banner", { scene })}
              >
                <span className={on ? "text-ink" : "text-body"}>
                  {SCENE_LABELS[scene]} <span className="text-mute">{scene}</span>
                </span>
                <span aria-hidden className={on ? "text-accent" : "text-mute"}>
                  {on ? "[x]" : "[ ]"}
                </span>
              </button>
            </div>
          );
        })}
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
        <Label text="Time zone (IANA)">
          <input className={field} value={profile.timeZone} onChange={(e) => setProfile({ timeZone: e.target.value })} />
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
        {/* The field keeps the typed text. The server turns it into a whole number (optionalCount in src/lib/content.ts). */}
        <Label text="X following (shown on the Twitter hover card, empty hides it)">
          <input
            className={field}
            inputMode="numeric"
            value={profile.xFollowing ?? ""}
            onChange={(e) => setProfile({ xFollowing: e.target.value as unknown as number })}
          />
        </Label>
        <Label text="X followers (shown on the Twitter hover card, empty hides it)">
          <input
            className={field}
            inputMode="numeric"
            value={profile.xFollowers ?? ""}
            onChange={(e) => setProfile({ xFollowers: e.target.value as unknown as number })}
          />
        </Label>
        <Label text="Duolingo username (the streak comes from Duolingo, empty hides the mark in the intro)">
          <input
            className={field}
            placeholder="001023.6354OwBA"
            value={profile.duolingo ?? ""}
            onChange={(e) => setProfile({ duolingo: e.target.value })}
          />
        </Label>
        <Label text="Booking link (empty hides the intro call button)">
          <input
            className={field}
            type="url"
            placeholder="https://cal.com/…"
            value={profile.booking ?? ""}
            onChange={(e) => setProfile({ booking: e.target.value })}
          />
        </Label>
        <Label text="Source repo of this site">
          <input className={field} type="url" value={profile.repo} onChange={(e) => setProfile({ repo: e.target.value })} />
        </Label>
        <Label text="Roles (one per line, index.md uses the first line)">
          <textarea
            className={field}
            rows={3}
            value={fromLines(profile.roles)}
            onChange={(e) => setProfile({ roles: toLines(e.target.value) })}
          />
        </Label>
      </div>
    ),
    projects: (
      <div className="flex flex-col gap-4">
        {content.projects.map((p: Project, i) => (
          <div key={i} className="flex flex-col gap-3 border border-dashed border-edge p-3">
            <ItemBar i={i} count={content.projects.length} list={projects as ReturnType<typeof useList>} />
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
              <Label text="Website link">
                <input
                  className={field}
                  type="url"
                  placeholder="https://"
                  value={p.site ?? ""}
                  onChange={(e) => projects.update(i, { site: e.target.value })}
                />
              </Label>
              <Label text="GitHub link">
                <input
                  className={field}
                  type="url"
                  placeholder="https://github.com/…"
                  value={p.github ?? ""}
                  onChange={(e) => projects.update(i, { github: e.target.value })}
                />
              </Label>
            </div>
            <p className="-mt-1 text-[13px] leading-5 text-mute">
              Fill in at least one link. The card shows a mark for each link: a globe for the website, the GitHub mark for GitHub. A dev project can have no link yet: the card then shows a greyed-out GitHub mark.
            </p>
            <Label text="Description">
              <textarea
                className={field}
                rows={2}
                value={p.description}
                onChange={(e) => projects.update(i, { description: e.target.value })}
              />
            </Label>
            <Label text="Preview label (the small text at the top left of the card)">
              <input className={field} value={p.shot} onChange={(e) => projects.update(i, { shot: e.target.value })} />
            </Label>
            <Label text="Preview art (ASCII, shown while there is no image or video)">
              <textarea
                className={`${field} whitespace-pre`}
                rows={7}
                wrap="off"
                spellCheck={false}
                value={p.art ?? ""}
                onChange={(e) => projects.update(i, { art: e.target.value })}
              />
            </Label>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] leading-5 text-dim">Image / video</span>
              {p.media && (
                <div className="flex flex-col gap-2">
                  <div className="h-40 w-full max-w-sm overflow-hidden border border-line bg-tint">
                    {p.media.kind === "video" ? (
                      <video className="size-full object-cover object-top" src={mediaUrl(p.media.key)} muted loop playsInline controls />
                    ) : (
                      <img className="size-full object-cover object-top" src={mediaUrl(p.media.key)} alt={p.media.alt} />
                    )}
                  </div>
                  <Label text={p.media.kind === "video" ? "Video description (screen readers read it aloud)" : "Image description (alt text)"}>
                    <input
                      className={field}
                      value={p.media.alt}
                      onChange={(e) => projects.update(i, { media: { ...p.media!, alt: e.target.value } })}
                    />
                  </Label>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Upload
                  slot="project"
                  label={p.media ? "Replace file" : "Upload an image or video"}
                  accept="image/png,image/jpeg,image/gif,image/webp,image/avif,video/mp4,video/webm"
                  onDone={(file) => projects.update(i, { media: { ...file, alt: p.media?.alt ?? "" } })}
                />
                {p.media && (
                  <button type="button" className={button} onClick={() => projects.update(i, { media: undefined })}>
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[13px] leading-5 text-mute">Images can be 5 MB at most. Videos (MP4, WebM) can be 25 MB at most. Videos play muted on a loop on the home page.</p>
            </div>
          </div>
        ))}
        <div>
          <button
            type="button"
            className={button}
            onClick={() => projects.add({ name: "", status: "live", description: "", site: "", github: "", shot: "Preview" })}
          >
            + Add project
          </button>
        </div>
      </div>
    ),
    skills: (
      <div className="flex flex-col gap-4">
        {content.skills.map((sk: Skill, i) => {
          const check = sk.svg?.trim() ? cleanSvg(sk.svg) : null;
          const builtIn = SKILL_MARKS[sk.name.trim()];
          return (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {/* The icon as the home page draws it: 14px high, in the chip's text colour. */}
                <span
                  className="flex size-8 shrink-0 items-center justify-center border border-line bg-tint text-mute"
                  title={check?.ok ? "The current icon" : undefined}
                  {...(check?.ok
                    ? { dangerouslySetInnerHTML: { __html: check.svg } }
                    : { children: <span className={`text-[11px] ${check ? "text-[#f87171]" : "text-mute"}`}>{check ? "!" : "—"}</span> })}
                />
                <input
                  className={`${field} w-auto min-w-0 flex-1`}
                  aria-label={`Name of skill ${i + 1}`}
                  value={sk.name}
                  onChange={(e) => skills.update(i, { name: e.target.value })}
                />
                <button type="button" className={button} disabled={i === 0} onClick={() => skills.move(i, -1)} aria-label="Move up">
                  ↑
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={i === content.skills.length - 1}
                  onClick={() => skills.move(i, 1)}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button type="button" className={button} onClick={() => skills.remove(i)}>
                  Delete
                </button>
              </div>
              <textarea
                className={`${field} h-16 resize-y font-mono text-[12px] leading-4`}
                aria-label={`SVG code of skill ${i + 1}`}
                placeholder="<svg viewBox=…>…</svg>"
                spellCheck={false}
                value={sk.svg ?? ""}
                onChange={(e) => skills.update(i, { svg: e.target.value })}
              />
              {check && !check.ok && <p role="alert" className="text-[13px] leading-5 text-[#f87171]">{check.error}</p>}
              {builtIn && !sk.svg?.trim() && (
                <div>
                  <button type="button" className={button} onClick={() => skills.update(i, { svg: builtIn })}>
                    Use the built-in {sk.name.trim()} icon
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div>
          <button type="button" className={button} onClick={() => skills.add({ name: "" })}>
            + Add skill
          </button>
        </div>
      </div>
    ),
    now: (
      <textarea
        className={`${field} whitespace-pre`}
        rows={5}
        wrap="off"
        aria-label="Now"
        value={fromLines(content.now)}
        onChange={(e) => set("now", toLines(e.target.value))}
      />
    ),
    snapshots: (
      <div className="flex flex-col gap-4">
        {content.snapshots.map((s: Snapshot, i) => (
          <div key={i} className="flex flex-col gap-3 border border-dashed border-edge p-3">
            <ItemBar i={i} count={content.snapshots.length} list={snapshots as ReturnType<typeof useList>} />
            <Label text="Title">
              <input className={field} value={s.label} onChange={(e) => snapshots.update(i, { label: e.target.value })} />
            </Label>
            <Label text="ASCII art">
              <textarea
                className={`${field} whitespace-pre`}
                rows={7}
                wrap="off"
                spellCheck={false}
                value={s.art}
                onChange={(e) => snapshots.update(i, { art: e.target.value })}
              />
            </Label>
          </div>
        ))}
        <div>
          <button type="button" className={button} onClick={() => snapshots.add({ label: "", art: "" })}>
            + Add snapshot
          </button>
        </div>
      </div>
    ),
  };

  return (
    <div className="flex flex-col">
      {SECTIONS.map(({ id, title, note }) => {
        const st = status[id] ?? { kind: "idle" };
        return (
          <section key={id} aria-labelledby={`admin-${id}`} className="band">
            <form
              className="rail flex flex-col gap-3 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                save(id);
              }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 id={`admin-${id}`} className="text-lg leading-[23px] font-bold text-ink">
                  {title}
                  {dirty(id) && <span className="ml-2 text-[13px] font-normal text-accent">· Unsaved</span>}
                </h2>
              </div>
              {note && <p className="text-[13px] leading-5 text-mute">{note}</p>}
              {body[id]}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="press bg-ink px-2.5 py-1.5 text-sm leading-5 font-medium text-bg disabled:opacity-40"
                  disabled={st.kind === "saving" || !dirty(id)}
                >
                  {st.kind === "saving" ? "Saving…" : `Save ${title}`}
                </button>
                <p role="status" className={`text-[13px] leading-5 ${st.kind === "error" ? "text-[#f87171]" : "text-dim"}`}>
                  {st.text}
                </p>
              </div>
            </form>
          </section>
        );
      })}
    </div>
  );
}
