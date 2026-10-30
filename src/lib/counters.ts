import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { z } from "astro/zod";
import { counters } from "../db/schema";

// One page view per request. Pets come in batches: the footer sends what it has every few seconds.
export const CounterInput = z.discriminatedUnion("name", [
  z.object({ name: z.literal("views"), by: z.literal(1).default(1) }),
  z.object({ name: z.literal("pets"), by: z.number().int().min(1).max(50) }),
]);

export type CounterName = z.infer<typeof CounterInput>["name"];
export type Counters = Record<CounterName, number>;

export async function getCounters(d1: D1Database): Promise<Counters> {
  const rows = await drizzle(d1).select().from(counters);
  const totals: Counters = { views: 0, pets: 0 };
  for (const row of rows) totals[row.name as CounterName] = row.count;
  return totals;
}

/** Adds `by` to one counter and returns both totals. */
export async function bumpCounter(d1: D1Database, name: CounterName, by: number) {
  await drizzle(d1)
    .insert(counters)
    .values({ name, count: by })
    // One statement adds, so concurrent visits are never lost.
    .onConflictDoUpdate({ target: counters.name, set: { count: sql`${counters.count} + ${by}` } });
  return getCounters(d1);
}
