import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { HOME_CACHE_TAG } from "@/lib/cache-tags";
import { describeError, getContent, saveSection, SectionInput } from "@/lib/content";

export const prerender = false; // reads and writes D1. src/middleware.ts checks Access first.

const fail = (error: string, status: number) => Response.json({ error }, { status });

export const GET: APIRoute = async () => Response.json(await getContent(env.DB));

export const PUT: APIRoute = async ({ request, url, cache }) => {
  // Only the admin page itself may write: a form on another site cannot send JSON with this origin.
  if (request.headers.get("origin") !== url.origin) return fail("The request came from the wrong origin. Save from the /admin page.", 403);
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return fail("The request is not valid. Reload the page and try again.", 415);
  }
  const parsed = SectionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(describeError(parsed.error), 400);
  await saveSection(env.DB, parsed.data);
  // The home page is cached at the edge under this tag; purging it is global, so the next load
  // anywhere renders the edit. A failed purge is not a failed save — the row is written — and
  // the cached copy then turns over within its minute.
  await cache.invalidate({ tags: HOME_CACHE_TAG }).catch((error: unknown) => console.error(`[cache] purge failed: ${String(error)}`));
  return Response.json({ section: parsed.data.section, data: parsed.data.data });
};
