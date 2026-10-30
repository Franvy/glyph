import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { z } from "astro/zod";
import { githubProfiles } from "../db/schema";
import { CALENDAR_MAX_AGE_MS } from "./github";

// The GitHub hover card: display name, followers, the stars on the user's own repositories, and the
// achievement badges. GraphQL has all but the badges; those are only on the profile page, so they are read from its HTML.

export type Achievement = { slug: string; name: string; icon: string; tier: number | null };
export type GitHubProfile = {
  login: string;
  name: string;
  stars: number;
  followers: number;
  /** Null when the profile page could not be read: the stored badges then stay. */
  achievements: Achievement[] | null;
};

/** The same refresh rhythm as the contribution calendar. */
export const PROFILE_MAX_AGE_MS = CALENDAR_MAX_AGE_MS;

const QUERY = `query ($login: String!) {
  user(login: $login) {
    login
    name
    followers { totalCount }
    repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100, orderBy: { field: STARGAZERS, direction: DESC }) {
      nodes { stargazerCount }
    }
  }
}`;

const count = z.number().int().min(0);
const GraphQLBody = z.object({
  data: z.object({
    user: z.object({
      login: z.string().min(1),
      name: z.string().nullable(),
      followers: z.object({ totalCount: count }),
      repositories: z.object({ nodes: z.array(z.object({ stargazerCount: count })) }),
    }),
  }),
});

/** Name, stars and followers from the API response, or null when it does not have the expected shape. */
export function parseProfile(body: unknown): { name: string; stars: number; followers: number } | null {
  const parsed = GraphQLBody.safeParse(body);
  if (!parsed.success) return null;
  const { user } = parsed.data.data;
  return {
    name: user.name?.trim() || user.login,
    stars: user.repositories.nodes.reduce((sum, repo) => sum + repo.stargazerCount, 0),
    followers: user.followers.totalCount,
  };
}

// One badge: <a href="/Login?achievement=slug&amp;…"><img src="…" alt="Achievement: Name" …/><span …>x3</span></a>
const BADGE = /<a href="\/[^"?]+\?achievement=([a-z0-9-]+)[^"]*"[^>]*>\s*<img src="([^"]+)"[^>]*alt="Achievement: ([^"]+)"[^>]*>(?:\s*<span[^>]*achievement-tier-label[^>]*>x(\d+)<\/span>)?/g;
/** Badge images are shown on the home page, so only GitHub's own asset host is allowed. */
const ICON_HOST = "https://github.githubassets.com/";

/** The badges on a profile page, each once, in page order. */
export function parseAchievements(html: string): Achievement[] {
  const seen = new Map<string, Achievement>();
  for (const [, slug, icon, name, tier] of html.matchAll(BADGE)) {
    if (seen.has(slug) || !icon.startsWith(ICON_HOST)) continue;
    seen.set(slug, { slug, name: name.replaceAll("&amp;", "&"), icon, tier: tier ? Number(tier) : null });
  }
  return [...seen.values()];
}

interface FetchOptions {
  token: string;
  login: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

const USER_AGENT = "glyph (franvy.cc)";

async function fetchAchievements(login: string, fetcher: typeof fetch, timeoutMs: number): Promise<Achievement[] | null> {
  try {
    const res = await fetcher(`https://github.com/${encodeURIComponent(login)}`, {
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status} ${res.statusText}`.trim());
    return parseAchievements(await res.text());
  } catch (error) {
    console.error("Could not read the GitHub achievements. The stored badges stay.", error);
    return null;
  }
}

/** The profile for `login`. Throws with the reason when the API does not give it; the badges may be null. */
export async function fetchProfile({ token, login, fetcher = fetch, timeoutMs = 5000 }: FetchOptions): Promise<GitHubProfile> {
  const [res, achievements] = await Promise.all([
    fetcher("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `bearer ${token}`, "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify({ query: QUERY, variables: { login } }),
      signal: AbortSignal.timeout(timeoutMs),
    }),
    fetchAchievements(login, fetcher, timeoutMs),
  ]);
  if (!res.ok) throw new Error(`GitHub answered ${res.status} ${res.statusText}`.trim());
  const profile = parseProfile(await res.json());
  if (!profile) throw new Error(`GitHub sent an unexpected body for ${login}`);
  return { login, ...profile, achievements };
}

const Stored = z.array(z.object({ slug: z.string(), name: z.string(), icon: z.string().startsWith(ICON_HOST), tier: count.nullable() }));

/** The stored profile and when it was fetched, or null when there is none. */
export async function readProfile(d1: D1Database, login: string): Promise<{ profile: GitHubProfile; fetchedAt: number } | null> {
  const [row] = await drizzle(d1).select().from(githubProfiles).where(eq(githubProfiles.login, login));
  if (!row) return null;
  const achievements = Stored.safeParse(JSON.parse(row.achievements));
  return {
    profile: { login: row.login, name: row.name, stars: row.stars, followers: row.followers, achievements: achievements.success ? achievements.data : [] },
    fetchedAt: row.fetchedAt,
  };
}

/** Writes the profile in one statement. Badges that are null keep the stored list (or an empty one). */
export async function saveProfile(d1: D1Database, profile: GitHubProfile, fetchedAt: number): Promise<void> {
  const row = {
    login: profile.login,
    name: profile.name,
    stars: profile.stars,
    followers: profile.followers,
    achievements: JSON.stringify(profile.achievements ?? []),
    fetchedAt,
  };
  const set = { name: row.name, stars: row.stars, followers: row.followers, fetchedAt, ...(profile.achievements && { achievements: row.achievements }) };
  await drizzle(d1).insert(githubProfiles).values(row).onConflictDoUpdate({ target: githubProfiles.login, set });
}

interface GetOptions extends FetchOptions {
  now: number;
  /** Keeps the Worker alive for a background refresh: `waitUntil` from cloudflare:workers. */
  defer: (promise: Promise<unknown>) => void;
}

/**
 * The profile for the home page. A stored row is served at once; when it is older than PROFILE_MAX_AGE_MS
 * a refresh runs in the background. Only the first visit waits for GitHub. Without a token GitHub is never
 * called. A failed fetch is logged and the stored row stays.
 */
export async function getProfile(d1: D1Database, { now, defer, ...fetchOptions }: GetOptions): Promise<GitHubProfile | null> {
  const stored = await readProfile(d1, fetchOptions.login);
  if (!fetchOptions.token) return stored?.profile ?? null;

  const refresh = async () => {
    try {
      await saveProfile(d1, await fetchProfile(fetchOptions), now);
      return (await readProfile(d1, fetchOptions.login))?.profile ?? null;
    } catch (error) {
      console.error("Could not refresh the GitHub profile. The stored row stays.", error);
      return null;
    }
  };

  if (!stored) return refresh();
  if (now - stored.fetchedAt > PROFILE_MAX_AGE_MS) defer(refresh());
  return stored.profile;
}
