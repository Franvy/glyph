import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, proxy } from "../../test/cf-env";
import { type DuolingoProfile, DUOLINGO_MAX_AGE_MS, fetchDuolingo, getDuolingo, parseDuolingo, readDuolingo, saveDuolingo } from "./duolingo";

afterAll(() => proxy.dispose());
beforeEach(async () => {
  await db.prepare("DELETE FROM duolingo_profiles").run();
});

const NOW = Date.parse("2026-10-23T06:00:00Z");
const USERNAME = "001023.6354OwBA";

// The answer of /2017-06-30/users?username=…, trimmed to the fields the card asks for.
const body = (streak = 181, totalXp = 28781) => ({
  users: [
    {
      username: USERNAME,
      name: "Franvy Dev",
      streak,
      totalXp,
      learningLanguage: "en",
      courses: [
        { title: "Spanish", learningLanguage: "es", xp: 120 },
        { title: "English", learningLanguage: "en", xp: 28661 },
      ],
    },
  ],
});

const profile: DuolingoProfile = { username: USERNAME, name: "Franvy Dev", streak: 181, totalXp: 28781, learning: "English" };

const duolingo = (status: number, json: unknown) => vi.fn(async () => Response.json(json, { status })) as unknown as typeof fetch;

describe("parseDuolingo", () => {
  it("reads the name, streak, XP and the course being learned", () => {
    expect(parseDuolingo(body())).toEqual(profile);
  });

  it("falls back to the username when there is no name, and to no course when none matches", () => {
    const [user] = body().users;
    expect(parseDuolingo({ users: [{ ...user, name: null, learningLanguage: "ja" }] })).toEqual({ ...profile, name: USERNAME, learning: null });
  });

  it("finds nothing for an unknown user or an unexpected body", () => {
    expect(parseDuolingo({ users: [] })).toBeNull();
    expect(parseDuolingo({})).toBeNull();
    expect(parseDuolingo({ users: [{ username: USERNAME, streak: -1, totalXp: 0 }] })).toBeNull();
  });
});

describe("fetchDuolingo", () => {
  it("asks for the username and returns the profile", async () => {
    const fetcher = duolingo(200, body());
    expect(await fetchDuolingo({ username: USERNAME, fetcher })).toEqual(profile);
    expect(String(vi.mocked(fetcher).mock.calls[0][0])).toContain(`username=${encodeURIComponent(USERNAME)}`);
  });

  it("throws with the reason when Duolingo does not answer or does not know the user", async () => {
    await expect(fetchDuolingo({ username: USERNAME, fetcher: duolingo(503, {}) })).rejects.toThrow(/503/);
    await expect(fetchDuolingo({ username: USERNAME, fetcher: duolingo(200, { users: [] }) })).rejects.toThrow(/unexpected/);
  });
});

describe("saveDuolingo", () => {
  it("stores the profile with the fetch time, and replaces it on the next save", async () => {
    await saveDuolingo(db, profile, NOW);
    expect(await readDuolingo(db, USERNAME)).toEqual({ profile, fetchedAt: NOW });
    await saveDuolingo(db, { ...profile, streak: 182, learning: null }, NOW + 1);
    expect(await readDuolingo(db, USERNAME)).toEqual({ profile: { ...profile, streak: 182, learning: null }, fetchedAt: NOW + 1 });
  });
});

describe("duolingo_profiles constraints", () => {
  const insert = (username: string, streak: number, totalXp: number) =>
    db
      .prepare("INSERT INTO duolingo_profiles (username, name, streak, total_xp, learning, fetched_at) VALUES (?, 'x', ?, ?, NULL, 1)")
      .bind(username, streak, totalXp)
      .run();

  it("refuses negative counts", async () => {
    await expect(insert(USERNAME, -1, 0)).rejects.toThrow(/CHECK/);
    await expect(insert(USERNAME, 0, -1)).rejects.toThrow(/CHECK/);
  });

  it("refuses an empty username", async () => {
    await expect(insert("", 0, 0)).rejects.toThrow(/CHECK/);
  });

  it("refuses a row without a name", async () => {
    await expect(
      db.prepare("INSERT INTO duolingo_profiles (username, name, streak, total_xp, fetched_at) VALUES ('a', NULL, 0, 0, 1)").run(),
    ).rejects.toThrow(/NOT NULL/);
  });
});

describe("getDuolingo", () => {
  const defer = () => {
    const pending: Promise<unknown>[] = [];
    return { pending, fn: (p: Promise<unknown>) => void pending.push(p) };
  };

  it("waits for Duolingo on the first visit, then serves the stored row", async () => {
    const fetcher = duolingo(200, body());
    expect(await getDuolingo(db, { username: USERNAME, fetcher, now: NOW, defer: defer().fn })).toEqual(profile);
    vi.mocked(fetcher).mockClear();
    expect(await getDuolingo(db, { username: USERNAME, fetcher, now: NOW + 1000, defer: defer().fn })).toEqual(profile);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("serves a stale row at once and refreshes it in the background", async () => {
    await saveDuolingo(db, profile, NOW);
    const later = defer();
    const now = NOW + DUOLINGO_MAX_AGE_MS + 1;
    const served = await getDuolingo(db, { username: USERNAME, fetcher: duolingo(200, body(182, 28900)), now, defer: later.fn });
    expect(served?.streak).toBe(181);
    await Promise.all(later.pending);
    expect((await readDuolingo(db, USERNAME))?.profile).toMatchObject({ streak: 182, totalXp: 28900 });
  });

  it("returns null when the first fetch fails, and keeps a stored row when a refresh fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getDuolingo(db, { username: USERNAME, fetcher: duolingo(500, {}), now: NOW, defer: defer().fn })).toBeNull();

    await saveDuolingo(db, profile, NOW);
    const later = defer();
    await getDuolingo(db, { username: USERNAME, fetcher: duolingo(500, {}), now: NOW + DUOLINGO_MAX_AGE_MS + 1, defer: later.fn });
    await Promise.all(later.pending);
    expect((await readDuolingo(db, USERNAME))?.profile).toEqual(profile);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
