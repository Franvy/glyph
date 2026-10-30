import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, proxy } from "../../test/cf-env";
import {
  type GitHubProfile,
  fetchProfile,
  getProfile,
  parseAchievements,
  parseProfile,
  PROFILE_MAX_AGE_MS,
  readProfile,
  saveProfile,
} from "./github-profile";

afterAll(() => proxy.dispose());
beforeEach(async () => {
  await db.prepare("DELETE FROM github_profiles").run();
});

const NOW = Date.parse("2026-10-22T06:00:00Z");

// The achievements block of github.com/<login>, trimmed. The sidebar repeats it for small screens.
const badge = (slug: string, name: string, icon: string, tier?: string) =>
  `<a href="/Franvy?achievement=${slug}&amp;tab=achievements" class="position-relative"><img src="${icon}" data-hovercard-type="achievement" width="64" alt="Achievement: ${name}" class="achievement-badge-sidebar" />` +
  (tier ? `<span class="Label achievement-tier-label achievement-tier-label--silver">${tier}</span>` : "") +
  "</a>";
const PAGE = [
  badge("pull-shark", "Pull Shark", "https://github.githubassets.com/assets/pull-shark-silver-0643f87ac9fd.png", "x3"),
  badge("quickdraw", "Quickdraw", "https://github.githubassets.com/assets/quickdraw-default-39c6aec8ff89.png"),
  badge("pull-shark", "Pull Shark", "https://github.githubassets.com/assets/pull-shark-silver-0643f87ac9fd.png", "x3"),
].join("");

const graphql = (name: string | null, stars: number[], followers = 42) => ({
  data: {
    user: {
      login: "Franvy",
      name,
      followers: { totalCount: followers },
      repositories: { nodes: stars.map((stargazerCount) => ({ stargazerCount })) },
    },
  },
});

const profile: GitHubProfile = {
  login: "franvy",
  name: "Franvy",
  stars: 128,
  followers: 42,
  achievements: [{ slug: "quickdraw", name: "Quickdraw", icon: "https://github.githubassets.com/assets/quickdraw-default-39c6aec8ff89.png", tier: null }],
};

/** Answers the GraphQL call with `api` and the profile page with `page`. */
function github(api: { status: number; json: unknown }, page: { status: number; html: string }) {
  return vi.fn(async (input: RequestInfo | URL) =>
    String(input).startsWith("https://api.github.com/")
      ? Response.json(api.json, { status: api.status })
      : new Response(page.html, { status: page.status, headers: { "content-type": "text/html" } }),
  ) as unknown as typeof fetch;
}

describe("parseAchievements", () => {
  it("reads each badge once, with its tier", () => {
    expect(parseAchievements(PAGE)).toEqual([
      { slug: "pull-shark", name: "Pull Shark", icon: "https://github.githubassets.com/assets/pull-shark-silver-0643f87ac9fd.png", tier: 3 },
      { slug: "quickdraw", name: "Quickdraw", icon: "https://github.githubassets.com/assets/quickdraw-default-39c6aec8ff89.png", tier: null },
    ]);
  });

  it("drops a badge whose image is not on GitHub's asset host", () => {
    expect(parseAchievements(badge("yolo", "YOLO", "https://evil.example/yolo.png"))).toEqual([]);
    expect(parseAchievements(badge("yolo", "YOLO", "javascript:alert(1)"))).toEqual([]);
  });

  it("finds nothing in a page without badges", () => {
    expect(parseAchievements("<html><body>Not Found</body></html>")).toEqual([]);
  });
});

describe("parseProfile", () => {
  it("adds up the stars of the repositories", () => {
    expect(parseProfile(graphql("Franvy", [100, 20, 8]))).toEqual({ name: "Franvy", stars: 128, followers: 42 });
  });

  it("uses the login when the user has no display name", () => {
    expect(parseProfile(graphql(null, []))).toEqual({ name: "Franvy", stars: 0, followers: 42 });
  });

  it("returns null for an unknown user or a body of the wrong shape", () => {
    expect(parseProfile({ data: { user: null } })).toBeNull();
    expect(parseProfile({ message: "Bad credentials" })).toBeNull();
    expect(parseProfile(graphql("Franvy", [-1]))).toBeNull();
  });
});

describe("fetchProfile", () => {
  it("asks the GraphQL API with the token and reads the badges from the profile page", async () => {
    const fetcher = github({ status: 200, json: graphql("Franvy", [100, 28]) }, { status: 200, html: PAGE });
    const result = await fetchProfile({ token: "t0k", login: "franvy", fetcher });
    expect(result).toMatchObject({ login: "franvy", name: "Franvy", stars: 128, followers: 42 });
    expect(result.achievements?.map((a) => a.slug)).toEqual(["pull-shark", "quickdraw"]);
    const calls = vi.mocked(fetcher).mock.calls as [string, RequestInit][];
    const api = calls.find(([url]) => url === "https://api.github.com/graphql")!;
    expect(new Headers(api[1].headers).get("authorization")).toBe("bearer t0k");
    expect(calls.some(([url]) => url === "https://github.com/franvy")).toBe(true);
  });

  it("has no badges (null) when the profile page fails, so the stored ones can stay", async () => {
    const fetcher = github({ status: 200, json: graphql("Franvy", [1]) }, { status: 503, html: "" });
    expect((await fetchProfile({ token: "t0k", login: "franvy", fetcher })).achievements).toBeNull();
  });

  it("says what went wrong when the API fails", async () => {
    const fetcher = github({ status: 401, json: { message: "Bad credentials" } }, { status: 200, html: PAGE });
    await expect(fetchProfile({ token: "bad", login: "franvy", fetcher })).rejects.toThrow(/401/);
  });
});

describe("saveProfile and readProfile", () => {
  it("starts empty", async () => {
    expect(await readProfile(db, "franvy")).toBeNull();
  });

  it("stores the profile with the fetch time, and replaces it on the next save", async () => {
    await saveProfile(db, profile, NOW);
    expect(await readProfile(db, "franvy")).toEqual({ profile, fetchedAt: NOW });
    await saveProfile(db, { ...profile, stars: 130 }, NOW + 1);
    expect(await readProfile(db, "franvy")).toEqual({ profile: { ...profile, stars: 130 }, fetchedAt: NOW + 1 });
  });

  it("keeps the stored badges when a refresh could not read them", async () => {
    await saveProfile(db, profile, NOW);
    await saveProfile(db, { ...profile, stars: 1, achievements: null }, NOW + 1);
    expect((await readProfile(db, "franvy"))!.profile).toEqual({ ...profile, stars: 1 });
  });
});

describe("github_profiles constraints", () => {
  const insert = (stars: number, followers: number, achievements: string) =>
    db
      .prepare("INSERT INTO github_profiles (login, name, stars, followers, achievements, fetched_at) VALUES ('franvy', 'Franvy', ?, ?, ?, 1)")
      .bind(stars, followers, achievements)
      .run();

  it("refuses negative counts", async () => {
    await expect(insert(-1, 0, "[]")).rejects.toThrow(/CHECK/);
    await expect(insert(0, -1, "[]")).rejects.toThrow(/CHECK/);
  });

  it("refuses badges that are not a JSON list", async () => {
    await expect(insert(0, 0, "not json")).rejects.toThrow(/CHECK/);
    await expect(insert(0, 0, '{"a":1}')).rejects.toThrow(/CHECK/);
  });

  it("refuses an empty login", async () => {
    await expect(
      db.prepare("INSERT INTO github_profiles (login, name, stars, followers, achievements, fetched_at) VALUES ('', 'x', 0, 0, '[]', 1)").run(),
    ).rejects.toThrow(/CHECK/);
  });
});

describe("getProfile", () => {
  const defer = () => {
    const pending: Promise<unknown>[] = [];
    return { pending, fn: (p: Promise<unknown>) => void pending.push(p) };
  };

  it("never calls GitHub without a token", async () => {
    const fetcher = github({ status: 200, json: graphql("Franvy", [1]) }, { status: 200, html: PAGE });
    expect(await getProfile(db, { token: "", login: "franvy", fetcher, now: NOW, defer: defer().fn })).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("waits for GitHub on the first visit, then serves the stored row", async () => {
    const fetcher = github({ status: 200, json: graphql("Franvy", [128]) }, { status: 200, html: PAGE });
    const first = await getProfile(db, { token: "t0k", login: "franvy", fetcher, now: NOW, defer: defer().fn });
    expect(first?.stars).toBe(128);
    vi.mocked(fetcher).mockClear();
    expect((await getProfile(db, { token: "t0k", login: "franvy", fetcher, now: NOW + 1000, defer: defer().fn }))?.stars).toBe(128);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("serves a stale row at once and refreshes it in the background", async () => {
    await saveProfile(db, profile, NOW);
    const fetcher = github({ status: 200, json: graphql("Franvy", [200]) }, { status: 200, html: PAGE });
    const later = defer();
    const now = NOW + PROFILE_MAX_AGE_MS + 1;
    expect((await getProfile(db, { token: "t0k", login: "franvy", fetcher, now, defer: later.fn }))?.stars).toBe(128);
    await Promise.all(later.pending);
    expect((await readProfile(db, "franvy"))?.profile.stars).toBe(200);
  });

  it("keeps the stored row when the refresh fails", async () => {
    await saveProfile(db, profile, NOW);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = github({ status: 500, json: {} }, { status: 500, html: "" });
    const later = defer();
    await getProfile(db, { token: "t0k", login: "franvy", fetcher, now: NOW + PROFILE_MAX_AGE_MS + 1, defer: later.fn });
    await Promise.all(later.pending);
    expect((await readProfile(db, "franvy"))?.profile).toEqual(profile);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
