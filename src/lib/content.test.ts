import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, proxy } from "../../test/cf-env";
import { defaultContent, duolingoLink, getContent, profileOf, projectLink, saveSection, SectionInput, socialsOf } from "./content";

afterAll(() => proxy.dispose());

beforeEach(async () => {
  await db.prepare("DELETE FROM sections").run();
});

const KEY = `${"a".repeat(64)}.png`;
const RUST = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false"><path d="M0 0h24v24H0z"/></svg>`;
const project = {
  name: "BoardUI",
  status: "live" as const,
  description: "Dashboard kit.",
  site: "https://example.com/boardui",
  github: "https://github.com/franvy/boardui",
  shot: "Dashboard",
  media: { key: KEY, kind: "image" as const, alt: "The BoardUI dashboard" },
};

describe("site content", () => {
  it("falls back to the defaults while nothing is saved", async () => {
    expect(await getContent(db)).toEqual(defaultContent);
  });

  it("returns a saved section and keeps the others at their defaults", async () => {
    await saveSection(db, { section: "skills", data: [{ name: "Astro" }, { name: "Rust", svg: RUST }] });
    const content = await getContent(db);
    expect(content.skills).toEqual([{ name: "Astro" }, { name: "Rust", svg: RUST }]);
    expect(content.projects).toEqual(defaultContent.projects);
    expect(content.profile).toEqual(defaultContent.profile);
  });

  it("accepts the three stages: live, beta and dev", () => {
    for (const status of ["live", "beta", "dev"]) {
      expect(SectionInput.safeParse({ section: "projects", data: [{ ...project, status }] }).success, status).toBe(true);
    }
  });

  it("reads a project saved as oss (the old status) as live, and keeps the saved projects", async () => {
    await db
      .prepare("INSERT INTO sections (name, data, updated_at) VALUES ('projects', ?, 0)")
      .bind(JSON.stringify([{ ...project, status: "oss" }]))
      .run();
    expect((await getContent(db)).projects).toEqual([{ ...project, status: "live" }]);
  });

  it("replaces a section on the next save", async () => {
    await saveSection(db, { section: "now", data: ["one"] });
    await saveSection(db, { section: "now", data: ["two", "three"] });
    expect((await getContent(db)).now).toEqual(["two", "three"]);
  });

  it("saves the profile, projects and snapshots", async () => {
    const profile = { ...defaultContent.profile, name: "Fran", headline: "Designer", city: "Hangzhou" };
    await saveSection(db, { section: "profile", data: profile });
    await saveSection(db, { section: "projects", data: [project] });
    await saveSection(db, { section: "snapshots", data: [{ label: "01 · desk", art: "[ ]" }] });
    const content = await getContent(db);
    expect(content.profile).toEqual(profile);
    expect(content.projects).toEqual([project]);
    expect(content.snapshots).toEqual([{ label: "01 · desk", art: "[ ]" }]);
  });

  it("keeps the banner on the clear garden until a theme is picked", async () => {
    expect((await getContent(db)).banner).toEqual({ scene: "clear" });
    await saveSection(db, { section: "banner", data: { scene: "snow" } });
    expect((await getContent(db)).banner).toEqual({ scene: "snow" });
  });

  it("uses the default when a stored section no longer matches its schema", async () => {
    await db.prepare(`INSERT INTO sections (name, data, updated_at) VALUES ('skills', '[1, 2]', 0)`).run();
    expect((await getContent(db)).skills).toEqual(defaultContent.skills);
  });

  it("refuses an unknown section in the table itself", async () => {
    await expect(
      db.prepare(`INSERT INTO sections (name, data, updated_at) VALUES ('posts', '[]', 0)`).run(),
    ).rejects.toThrow(/CHECK/);
  });

  it("refuses data that is not JSON", async () => {
    await expect(
      db.prepare(`INSERT INTO sections (name, data, updated_at) VALUES ('now', 'not json', 0)`).run(),
    ).rejects.toThrow(/CHECK/);
  });

  it("refuses a row without data", async () => {
    await expect(
      db.prepare(`INSERT INTO sections (name, data, updated_at) VALUES ('now', NULL, 0)`).run(),
    ).rejects.toThrow(/NOT NULL/);
  });
});

describe("SectionInput", () => {
  it("accepts every section in its shape", () => {
    for (const body of [
      { section: "profile", data: defaultContent.profile },
      { section: "projects", data: [project] },
      { section: "skills", data: [{ name: "Astro" }, { name: "Rust", svg: RUST }] },
      { section: "projects", data: [{ ...project, site: undefined }] },
      { section: "projects", data: [{ ...project, github: undefined, media: undefined }] },
      { section: "projects", data: [{ ...project, media: { key: `${"b".repeat(64)}.mp4`, kind: "video", alt: "A demo of BoardUI" } }] },
      { section: "now", data: [] },
      { section: "snapshots", data: [{ label: "a", art: "b" }] },
      ...["clear", "cloudy", "rain", "storm", "snow", "fog", "spring"].map((scene) => ({ section: "banner", data: { scene } })),
    ]) {
      expect(SectionInput.safeParse(body).success, JSON.stringify(body)).toBe(true);
    }
  });

  it("lets only a dev project go without a link: its source is not public yet", () => {
    const unlinked = { ...project, site: undefined, github: undefined };
    const parsed = SectionInput.parse({ section: "projects", data: [{ ...unlinked, status: "dev" }] });
    expect(parsed.data).toEqual([{ ...unlinked, status: "dev" }]);
    expect(projectLink({ ...unlinked, status: "dev" })).toBeUndefined();
    for (const status of ["live", "beta"]) {
      expect(SectionInput.safeParse({ section: "projects", data: [{ ...unlinked, status }] }).success, status).toBe(false);
    }
  });

  it("trims text, drops empty list lines and treats an empty link as no link", () => {
    expect(SectionInput.parse({ section: "now", data: [" one ", "", "  "] })).toEqual({ section: "now", data: ["one"] });
    expect(SectionInput.parse({ section: "skills", data: [{ name: " Astro ", svg: " " }] })).toEqual({
      section: "skills",
      data: [{ name: "Astro" }],
    });
    const parsed = SectionInput.parse({ section: "projects", data: [{ ...project, github: "  " }] });
    expect(parsed.data).toEqual([{ ...project, github: undefined }]);
  });

  it("takes an optional booking link on the profile, and an empty one means no link", () => {
    const p = defaultContent.profile;
    const withLink = SectionInput.parse({ section: "profile", data: { ...p, booking: "https://cal.com/franvy/intro" } });
    expect(withLink.data).toMatchObject({ booking: "https://cal.com/franvy/intro" });
    const empty = SectionInput.parse({ section: "profile", data: { ...p, booking: "  " } });
    expect(empty.data).toMatchObject({ booking: undefined });
  });

  it("takes the X following and follower counts as whole numbers, and an empty field means no count", () => {
    const p = defaultContent.profile;
    const withCounts = SectionInput.parse({ section: "profile", data: { ...p, xFollowing: "312", xFollowers: 1024 } });
    expect(withCounts.data).toMatchObject({ xFollowing: 312, xFollowers: 1024 });
    const empty = SectionInput.parse({ section: "profile", data: { ...p, xFollowing: "", xFollowers: " " } });
    expect(empty.data).toMatchObject({ xFollowing: undefined, xFollowers: undefined });
  });

  it("drops the Reddit fields a profile saved before Reddit was removed", () => {
    const p = defaultContent.profile;
    const old = SectionInput.parse({
      section: "profile",
      data: { ...p, reddit: "https://www.reddit.com/user/OwnAssistance1469", redditKarma: 1240, redditTrophy: { name: "Best Comment" } },
    });
    expect(old.data).not.toHaveProperty("reddit");
    expect(old.data).not.toHaveProperty("redditKarma");
    expect(old.data).not.toHaveProperty("redditTrophy");
  });

  it("takes a Duolingo username, and an empty field means no Duolingo", () => {
    const p = defaultContent.profile;
    expect(SectionInput.parse({ section: "profile", data: { ...p, duolingo: " 001023.6354OwBA " } }).data).toMatchObject({ duolingo: "001023.6354OwBA" });
    expect(SectionInput.parse({ section: "profile", data: { ...p, duolingo: "" } }).data).toMatchObject({ duolingo: undefined });
  });

  it("drops the intro fan images that older saves still hold", () => {
    const peek = [{ key: KEY, kind: "image", alt: "The board" }];
    expect(SectionInput.parse({ section: "projects", data: [{ ...project, peek }] }).data).toEqual([project]);
  });

  it("keeps the leading spaces of a project's ascii preview and treats an empty one as no preview", () => {
    const art = "  .--.\n  |  |  \n\n";
    const parsed = SectionInput.parse({ section: "projects", data: [{ ...project, art }] });
    expect(parsed.data).toEqual([{ ...project, art: "  .--.\n  |  |" }]);
    const empty = SectionInput.parse({ section: "projects", data: [{ ...project, art: " \n " }] });
    expect(empty.data).toEqual([{ ...project, art: undefined }]);
  });

  it("rejects anything else", () => {
    const p = defaultContent.profile;
    for (const body of [
      null,
      {},
      { section: "posts", data: [] },
      { section: "skills" },
      { section: "skills", data: "Astro" },
      { section: "skills", data: ["Astro"] },
      { section: "skills", data: [{ name: "" }] },
      { section: "skills", data: [{ name: "Rust", svg: `<svg viewBox="0 0 1 1" onload="alert(1)"/>` }] },
      { section: "skills", data: [{ name: "Rust", svg: "<div>Rust</div>" }] },
      { section: "projects", data: [{ ...project, site: undefined, github: undefined }] },
      { section: "projects", data: [{ ...project, site: "", github: "" }] },
      { section: "projects", data: [{ ...project, github: "javascript:alert(1)" }] },
      { section: "projects", data: [{ ...project, media: { ...project.media, key: "x.png" } }] },
      { section: "projects", data: [{ ...project, media: { ...project.media, alt: "" } }] },
      { section: "projects", data: [{ ...project, media: { ...project.media, kind: "audio" } }] },
      { section: "profile", data: { ...p, name: "" } },
      { section: "profile", data: { ...p, email: "not-an-email" } },
      { section: "profile", data: { ...p, github: "javascript:alert(1)" } },
      { section: "profile", data: { ...p, x: "ftp://x.com/franvy" } },
      { section: "profile", data: { ...p, booking: "javascript:alert(1)" } },
      { section: "profile", data: { ...p, timeZone: "Mars/Olympus" } },
      { section: "profile", data: { ...p, roles: [] } },
      { section: "profile", data: { ...p, xFollowers: -1 } },
      { section: "profile", data: { ...p, xFollowers: 1.5 } },
      { section: "profile", data: { ...p, xFollowing: "many" } },
      { section: "profile", data: { ...p, duolingo: "../admin" } },
      { section: "profile", data: { ...p, duolingo: "a b" } },
      { section: "projects", data: [{ ...project, status: "dead" }] },
      { section: "projects", data: [{ ...project, description: "x".repeat(201) }] },
      { section: "projects", data: Array.from({ length: 21 }, () => project) },
      { section: "projects", data: [{ ...project, art: "x".repeat(601) }] },
      { section: "snapshots", data: [{ label: "", art: "b" }] },
      { section: "banner", data: {} },
      { section: "banner", data: { scene: "hail" } },
      { section: "banner", data: "snow" },
    ]) {
      expect(SectionInput.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });
});

describe("projectLink", () => {
  it("opens the website when there is one, otherwise GitHub", () => {
    expect(projectLink(project)).toBe(project.site);
    expect(projectLink({ ...project, site: undefined })).toBe(project.github);
  });
});

describe("socialsOf", () => {
  it("names the X profile Twitter and gives it the X mark", () => {
    const profile = defaultContent.profile;
    expect(socialsOf(profile)[1]).toEqual({ label: "Twitter", href: profile.x, icon: "x" });
  });

  it("lists GitHub and Twitter only: email has its own button, Duolingo is a mark in the intro", () => {
    expect(socialsOf(defaultContent.profile).map((s) => s.label)).toEqual(["GitHub", "Twitter"]);
  });
});

describe("duolingoLink", () => {
  it("links to the profile page of the username", () => {
    expect(duolingoLink("001023.6354OwBA")).toBe("https://www.duolingo.com/profile/001023.6354OwBA");
  });
});

describe("profileOf", () => {
  it("reads the handle and a short label from a profile link", () => {
    expect(profileOf("https://github.com/franvy")).toEqual({ handle: "franvy", label: "github.com/franvy" });
    expect(profileOf("https://www.x.com/franvy/")).toEqual({ handle: "franvy", label: "x.com/franvy" });
    expect(profileOf("https://www.duolingo.com/profile/001023.6354OwBA")).toEqual({
      handle: "001023.6354OwBA",
      label: "duolingo.com/profile/001023.6354OwBA",
    });
  });

  it("has no handle when the link has no path", () => {
    expect(profileOf("https://example.com")).toEqual({ handle: null, label: "example.com" });
  });
});

describe("skill icons", () => {
  it("cleans pasted SVG code before it is saved, and says what is wrong when it cannot", () => {
    const parsed = SectionInput.parse({
      section: "skills",
      data: [{ name: "Rust", svg: `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><title>Rust</title><path d="M0 0h24v24H0z"/></svg>` }],
    });
    expect(parsed.data).toEqual([{ name: "Rust", svg: RUST }]);

    const refused = SectionInput.safeParse({ section: "skills", data: [{ name: "Rust", svg: `<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>` }] });
    expect(refused.success).toBe(false);
    expect(refused.error?.issues[0].message).toMatch(/Rust.*<script>/);
  });

  it("shows each default skill with the icon the home page renders", () => {
    for (const name of ["Next.js", "React", "TypeScript", "Cloudflare", "Paper"]) {
      expect(defaultContent.skills.find((s) => s.name === name)?.svg, name).toMatch(/^<svg viewBox=/);
    }
  });
});
