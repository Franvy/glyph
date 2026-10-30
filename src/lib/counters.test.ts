import { afterAll, describe, expect, it } from "vitest";
import { db, proxy } from "../../test/cf-env";
import { bumpCounter, CounterInput, getCounters } from "./counters";

afterAll(() => proxy.dispose());

describe("site counters", () => {
  it("starts at zero", async () => {
    expect(await getCounters(db)).toEqual({ views: 0, pets: 0 });
  });

  it("adds to one counter and returns both totals", async () => {
    expect(await bumpCounter(db, "views", 1)).toEqual({ views: 1, pets: 0 });
    expect(await bumpCounter(db, "pets", 7)).toEqual({ views: 1, pets: 7 });
    expect(await bumpCounter(db, "pets", 3)).toEqual({ views: 1, pets: 10 });
  });

  it("does not lose a count when many arrive at once", async () => {
    const before = (await getCounters(db)).views;
    await Promise.all(Array.from({ length: 25 }, () => bumpCounter(db, "views", 1)));
    expect((await getCounters(db)).views).toBe(before + 25);
  });

  it("refuses an unknown counter in the table itself", async () => {
    await expect(db.prepare("INSERT INTO counters (name, count) VALUES ('likes', 1)").run()).rejects.toThrow(/CHECK/);
  });

  it("refuses a negative count", async () => {
    await expect(db.prepare("UPDATE counters SET count = -1 WHERE name = 'views'").run()).rejects.toThrow(/CHECK/);
  });

  it("refuses a row without a count", async () => {
    await expect(db.prepare("UPDATE counters SET count = NULL WHERE name = 'views'").run()).rejects.toThrow(/NOT NULL/);
  });
});

describe("CounterInput", () => {
  it("accepts a view, and a batch of pets", () => {
    expect(CounterInput.parse({ name: "views" })).toEqual({ name: "views", by: 1 });
    expect(CounterInput.parse({ name: "pets", by: 12 })).toEqual({ name: "pets", by: 12 });
  });

  it("rejects anything else", () => {
    for (const body of [
      null,
      {},
      { name: "likes" },
      { name: "views", by: 5 }, // one view per request
      { name: "pets" },
      { name: "pets", by: 0 },
      { name: "pets", by: 51 },
      { name: "pets", by: 1.5 },
      { name: "pets", by: "3" },
    ]) {
      expect(CounterInput.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });
});
