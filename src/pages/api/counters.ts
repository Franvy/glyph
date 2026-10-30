import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { bumpCounter, CounterInput, getCounters } from "@/lib/counters";

export const prerender = false; // reads and writes D1

export const GET: APIRoute = async () => Response.json(await getCounters(env.DB));

// Base.astro posts one view per page load; the footer cat posts pets in batches.
export const POST: APIRoute = async ({ request }) => {
  const parsed = CounterInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "The request is not valid. Reload the page and try again." }, { status: 400 });
  return Response.json(await bumpCounter(env.DB, parsed.data.name, parsed.data.by));
};
