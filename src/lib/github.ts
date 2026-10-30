import { asc, lt, max, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { z } from "astro/zod";
import { contributionDays } from "../db/schema";

// The GitHub contribution calendar. GraphQL is the only API that has it, and GraphQL needs a token.
// With the owner's own token, private contributions count too.

export type CalendarDay = { date: string; count: number };

/** Rows older than this are served once more, then refreshed in the background. */
export const CALENDAR_MAX_AGE_MS = 6 * 3600_000;

const QUERY = `query ($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
  }
}`;

const GraphQLBody = z.object({
  data: z.object({
    user: z.object({
      contributionsCollection: z.object({
        contributionCalendar: z.object({
          weeks: z.array(
            z.object({
              contributionDays: z.array(
                z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), contributionCount: z.number().int().min(0) }),
              ),
            }),
          ),
        }),
      }),
    }),
  }),
});

/** The days in the API response, or null when it does not have the expected shape. */
export function parseCalendar(body: unknown): CalendarDay[] | null {
  const parsed = GraphQLBody.safeParse(body);
  if (!parsed.success) return null;
  return parsed.data.data.user.contributionsCollection.contributionCalendar.weeks.flatMap((week) =>
    week.contributionDays.map((day) => ({ date: day.date, count: day.contributionCount })),
  );
}

interface FetchOptions {
  token: string;
  login: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

/** The last year of days for `login`. Throws with the reason when GitHub does not give them. */
export async function fetchCalendar({ token, login, fetcher = fetch, timeoutMs = 5000 }: FetchOptions): Promise<CalendarDay[]> {
  const res = await fetcher("https://api.github.com/graphql", {
    method: "POST",
    headers: { authorization: `bearer ${token}`, "content-type": "application/json", "user-agent": "glyph (franvy.cc)" },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} ${res.statusText}`.trim());
  const days = parseCalendar(await res.json());
  if (!days) throw new Error(`GitHub sent an unexpected body for ${login}`);
  return days;
}

/** Replaces the stored calendar with `days`, in one batch. Days before the first new day are removed. */
export async function saveCalendar(d1: D1Database, days: CalendarDay[], fetchedAt: number): Promise<void> {
  if (days.length === 0) return;
  const db = drizzle(d1);
  const first = days.reduce((min, d) => (d.date < min ? d.date : min), days[0].date);
  // D1 limits bound parameters per statement, so insert a week at a time.
  const upserts = [];
  for (let i = 0; i < days.length; i += 7) {
    upserts.push(
      db
        .insert(contributionDays)
        .values(days.slice(i, i + 7).map((d) => ({ ...d, fetchedAt })))
        .onConflictDoUpdate({
          target: contributionDays.date,
          set: { count: sql`excluded.count`, fetchedAt: sql`excluded.fetched_at` },
        }),
    );
  }
  await db.batch([db.delete(contributionDays).where(lt(contributionDays.date, first)), ...upserts]);
}

/** The stored days in date order, and when they were fetched (null when there are none). */
export async function readCalendar(d1: D1Database): Promise<{ days: CalendarDay[]; fetchedAt: number | null }> {
  const db = drizzle(d1);
  const [days, [latest]] = await db.batch([
    db.select({ date: contributionDays.date, count: contributionDays.count }).from(contributionDays).orderBy(asc(contributionDays.date)),
    db.select({ fetchedAt: max(contributionDays.fetchedAt) }).from(contributionDays),
  ]);
  return { days, fetchedAt: latest?.fetchedAt ?? null };
}

interface GetOptions extends FetchOptions {
  now: number;
  /** Keeps the Worker alive for a background refresh: `waitUntil` from cloudflare:workers. */
  defer: (promise: Promise<unknown>) => void;
}

/**
 * The calendar for the home page. Stored rows are served at once; when they are older than
 * CALENDAR_MAX_AGE_MS a refresh runs in the background. Only the first visit waits for GitHub.
 * Without a token GitHub is never called. A failed fetch is logged and the stored rows stay.
 */
export async function getCalendar(d1: D1Database, { now, defer, ...fetchOptions }: GetOptions): Promise<CalendarDay[]> {
  const stored = await readCalendar(d1);
  if (!fetchOptions.token) return stored.days;

  const refresh = async () => {
    try {
      const days = await fetchCalendar(fetchOptions);
      await saveCalendar(d1, days, now);
      return days;
    } catch (error) {
      console.error("Could not refresh the GitHub contribution calendar. The stored days stay.", error);
      return null;
    }
  };

  if (stored.fetchedAt === null) return (await refresh()) ?? [];
  if (now - stored.fetchedAt > CALENDAR_MAX_AGE_MS) defer(refresh());
  return stored.days;
}
