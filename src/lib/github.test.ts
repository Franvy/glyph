import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, proxy } from "../../test/cf-env";
import { CALENDAR_MAX_AGE_MS, fetchCalendar, getCalendar, parseCalendar, readCalendar, saveCalendar } from "./github";

afterAll(() => proxy.dispose());
beforeEach(async () => {
  await db.prepare("DELETE FROM contribution_days").run();
});

// The shape GitHub's GraphQL API answers with, trimmed to what the query asks for.
const body = (days: [string, number][]) => ({
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          weeks: [{ contributionDays: days.map(([date, contributionCount]) => ({ date, contributionCount })) }],
        },
      },
    },
  },
});

const reply = (status: number, json: unknown) => vi.fn(async () => Response.json(json, { status })) as unknown as typeof fetch;

const NOW = Date.parse("2026-10-22T06:00:00Z");

describe("parseCalendar", () => {
  it("flattens the weeks into days", () => {
    expect(parseCalendar(body([["2026-10-20", 3], ["2026-10-21", 0]]))).toEqual([
      { date: "2026-10-20", count: 3 },
      { date: "2026-10-21", count: 0 },
    ]);
  });

  it("returns null for an unknown user or a body of the wrong shape", () => {
    expect(parseCalendar({ data: { user: null }, errors: [{ message: "Could not resolve to a User" }] })).toBeNull();
    expect(parseCalendar({ message: "Bad credentials" })).toBeNull();
    expect(parseCalendar(body([["20 Oct", 1]]))).toBeNull();
    expect(parseCalendar(body([["2026-10-20", -1]]))).toBeNull();
  });
});

describe("fetchCalendar", () => {
  it("asks the GraphQL API for the login, with the token", async () => {
    const fetcher = reply(200, body([["2026-10-20", 3]]));
    expect(await fetchCalendar({ token: "t0k", login: "franvy", fetcher })).toEqual([{ date: "2026-10-20", count: 3 }]);
    const [url, init] = vi.mocked(fetcher).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/graphql");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("bearer t0k");
    expect(new Headers(init.headers).get("user-agent")).toBeTruthy(); // GitHub refuses a request without one
    expect(JSON.parse(init.body as string).variables).toEqual({ login: "franvy" });
  });

  it("says what went wrong on an HTTP error or a bad body", async () => {
    await expect(fetchCalendar({ token: "bad", login: "franvy", fetcher: reply(401, { message: "Bad credentials" }) })).rejects.toThrow(/401/);
    await expect(fetchCalendar({ token: "t0k", login: "nobody", fetcher: reply(200, { data: { user: null } }) })).rejects.toThrow(
      /unexpected/i,
    );
  });
});

describe("saveCalendar and readCalendar", () => {
  it("starts empty", async () => {
    expect(await readCalendar(db)).toEqual({ days: [], fetchedAt: null });
  });

  it("stores the days in date order with the fetch time", async () => {
    await saveCalendar(db, [{ date: "2026-10-21", count: 0 }, { date: "2026-10-20", count: 3 }], NOW);
    expect(await readCalendar(db)).toEqual({
      days: [{ date: "2026-10-20", count: 3 }, { date: "2026-10-21", count: 0 }],
      fetchedAt: NOW,
    });
  });

  it("replaces counts and drops days older than the new calendar", async () => {
    await saveCalendar(db, [{ date: "2025-10-19", count: 9 }, { date: "2026-10-20", count: 1 }], NOW);
    await saveCalendar(db, [{ date: "2025-10-20", count: 0 }, { date: "2026-10-20", count: 4 }], NOW + 1);
    expect(await readCalendar(db)).toEqual({
      days: [{ date: "2025-10-20", count: 0 }, { date: "2026-10-20", count: 4 }],
      fetchedAt: NOW + 1,
    });
  });

  it("leaves the table as it was when there is nothing to save", async () => {
    await saveCalendar(db, [{ date: "2026-10-20", count: 1 }], NOW);
    await saveCalendar(db, [], NOW + 1);
    expect((await readCalendar(db)).days).toHaveLength(1);
  });

  it("refuses a bad date or a negative count in the table itself", async () => {
    const insert = (date: string, count: number) =>
      db.prepare("INSERT INTO contribution_days (date, count, fetched_at) VALUES (?, ?, 0)").bind(date, count).run();
    await expect(insert("20 Oct 2026", 1)).rejects.toThrow(/CHECK/);
    await expect(insert("2026-10-20", -1)).rejects.toThrow(/CHECK/);
    await expect(db.prepare("INSERT INTO contribution_days (date, count) VALUES ('2026-10-20', 1)").run()).rejects.toThrow(/NOT NULL/);
  });
});

describe("getCalendar", () => {
  const options = (fetcher: typeof fetch, token = "t0k") => {
    const deferred: Promise<unknown>[] = [];
    return { deferred, opts: { token, login: "franvy", now: NOW, fetcher, defer: (p: Promise<unknown>) => void deferred.push(p) } };
  };

  it("fetches and stores the calendar on the first visit", async () => {
    const { opts } = options(reply(200, body([["2026-10-20", 3]])));
    expect(await getCalendar(db, opts)).toEqual([{ date: "2026-10-20", count: 3 }]);
    expect((await readCalendar(db)).fetchedAt).toBe(NOW);
  });

  it("serves fresh rows without calling GitHub", async () => {
    await saveCalendar(db, [{ date: "2026-10-20", count: 3 }], NOW - CALENDAR_MAX_AGE_MS + 1000);
    const fetcher = reply(200, body([["2026-10-20", 5]]));
    const { opts, deferred } = options(fetcher);
    expect(await getCalendar(db, opts)).toEqual([{ date: "2026-10-20", count: 3 }]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(deferred).toHaveLength(0);
  });

  it("serves stale rows at once and refreshes them in the background", async () => {
    await saveCalendar(db, [{ date: "2026-10-20", count: 3 }], NOW - CALENDAR_MAX_AGE_MS - 1000);
    const { opts, deferred } = options(reply(200, body([["2026-10-20", 5]])));
    expect(await getCalendar(db, opts)).toEqual([{ date: "2026-10-20", count: 3 }]);
    await Promise.all(deferred);
    expect(await readCalendar(db)).toEqual({ days: [{ date: "2026-10-20", count: 5 }], fetchedAt: NOW });
  });

  it("keeps the old rows and logs when the refresh fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await saveCalendar(db, [{ date: "2026-10-20", count: 3 }], 0);
    const { opts, deferred } = options(reply(502, {}));
    expect(await getCalendar(db, opts)).toEqual([{ date: "2026-10-20", count: 3 }]);
    await Promise.all(deferred);
    expect((await readCalendar(db)).days).toEqual([{ date: "2026-10-20", count: 3 }]);
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/GitHub/), expect.anything());
    error.mockRestore();
  });

  it("returns no days when GitHub fails on the first visit", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { opts } = options(reply(401, { message: "Bad credentials" }));
    expect(await getCalendar(db, opts)).toEqual([]);
    error.mockRestore();
  });

  it("never calls GitHub without a token", async () => {
    await saveCalendar(db, [{ date: "2026-10-20", count: 3 }], 0);
    const fetcher = reply(200, body([]));
    const { opts, deferred } = options(fetcher, "");
    expect(await getCalendar(db, opts)).toEqual([{ date: "2026-10-20", count: 3 }]);
    expect(deferred).toHaveLength(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
