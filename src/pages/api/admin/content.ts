import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { describeError, getContent, saveSection, SectionInput } from "@/lib/content";

export const prerender = false; // reads and writes D1. src/middleware.ts checks Access first.

const fail = (error: string, status: number) => Response.json({ error }, { status });

export const GET: APIRoute = async () => Response.json(await getContent(env.DB));

export const PUT: APIRoute = async ({ request, url }) => {
  // Only the admin page itself may write: a form on another site cannot send JSON with this origin.
  if (request.headers.get("origin") !== url.origin) return fail("The request came from the wrong origin. Save from the /admin page.", 403);
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return fail("The request is not valid. Reload the page and try again.", 415);
  }
  const parsed = SectionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(describeError(parsed.error), 400);
  await saveSection(env.DB, parsed.data);
  return Response.json({ section: parsed.data.section, data: parsed.data.data });
};
