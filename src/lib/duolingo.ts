import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { z } from "astro/zod";
import { duolingoProfiles } from "../db/schema";

// The Duolingo hover card: display name, streak, total XP and the course being learned. Duolingo's public
// users endpoint gives them without a token. It is not a documented API, so a body of another shape is refused.

export type DuolingoProfile = {
  username: string;
  name: string;
  streak: number;
  totalXp: number;
  /** The title of the current course ("English"). Null when no course matches the learning language. */
  learning: string | null;
};

/** A streak changes once a day. Every 6 hours keeps it close without asking often. */
export const DUOLINGO_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const FIELDS = "users{username,name,streak,totalXp,learningLanguage,courses{title,learningLanguage,xp}}";

const count = z.number().int().min(0);
const Body = z.object({
  users: z
    .array(
      z.object({
        username: z.string().min(1),
        name: z.string().nullish(),
        streak: count,
        totalXp: count,
        learningLanguage: z.string().nullish(),
        courses: z.array(z.object({ title: z.string(), learningLanguage: z.string() })).default([]),
      }),
    )
    .min(1),
});

/** The profile in the endpoint's answer, or null when the user is unknown or the body has another shape. */
export function parseDuolingo(body: unknown): DuolingoProfile | null {
  const parsed = Body.safeParse(body);
  if (!parsed.success) return null;
  const [user] = parsed.data.users;
  const course = user.courses.find((c) => c.learningLanguage === user.learningLanguage);
  return {
    username: user.username,
    name: user.name?.trim() || user.username,
    streak: user.streak,
    totalXp: user.totalXp,
    learning: course?.title ?? null,
  };
}

interface FetchOptions {
  username: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

/** The profile for `username`. Throws with the reason when Duolingo does not give it. */
export async function fetchDuolingo({ username, fetcher = fetch, timeoutMs = 5000 }: FetchOptions): Promise<DuolingoProfile> {
  const url = `https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(username)}&fields=${encodeURIComponent(FIELDS)}`;
  const res = await fetcher(url, {
    headers: { "user-agent": "glyph (franvy.cc)", accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Duolingo answered ${res.status} ${res.statusText}`.trim());
  const profile = parseDuolingo(await res.json());
  if (!profile) throw new Error(`Duolingo sent an unexpected body for ${username}`);
  return profile;
}

/** The stored profile and when it was fetched, or null when there is none. */
export async function readDuolingo(d1: D1Database, username: string): Promise<{ profile: DuolingoProfile; fetchedAt: number } | null> {
  const [row] = await drizzle(d1).select().from(duolingoProfiles).where(eq(duolingoProfiles.username, username));
  if (!row) return null;
  const { fetchedAt, ...profile } = row;
  return { profile, fetchedAt };
}

/** Writes the profile in one statement. */
export async function saveDuolingo(d1: D1Database, profile: DuolingoProfile, fetchedAt: number): Promise<void> {
  const { username, ...rest } = profile;
  const set = { ...rest, fetchedAt };
  await drizzle(d1)
    .insert(duolingoProfiles)
    .values({ username, ...set })
    .onConflictDoUpdate({ target: duolingoProfiles.username, set });
}

interface GetOptions extends FetchOptions {
  now: number;
  /** Keeps the Worker alive for a background refresh: `waitUntil` from cloudflare:workers. */
  defer: (promise: Promise<unknown>) => void;
}

/**
 * The profile for the home page. A stored row is served at once; when it is older than DUOLINGO_MAX_AGE_MS
 * a refresh runs in the background. Only the first visit waits for Duolingo. A failed fetch is logged and
 * the stored row stays.
 */
export async function getDuolingo(d1: D1Database, { now, defer, ...fetchOptions }: GetOptions): Promise<DuolingoProfile | null> {
  const stored = await readDuolingo(d1, fetchOptions.username);

  const refresh = async () => {
    try {
      // Stored under the configured name, so a username typed in another case still finds its row.
      const profile = { ...(await fetchDuolingo(fetchOptions)), username: fetchOptions.username };
      await saveDuolingo(d1, profile, now);
      return profile;
    } catch (error) {
      console.error("Could not refresh the Duolingo profile. The stored row stays.", error);
      return null;
    }
  };

  if (!stored) return refresh();
  if (now - stored.fetchedAt > DUOLINGO_MAX_AGE_MS) defer(refresh());
  return stored.profile;
}
