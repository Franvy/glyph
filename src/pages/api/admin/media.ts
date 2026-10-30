import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { z } from "astro/zod";
import { checkUpload, putMedia } from "@/lib/media";

export const prerender = false; // writes R2. src/middleware.ts checks Access first.

const fail = (error: string, status: number) => Response.json({ error }, { status });
const Slot = z.enum(["project"]);

// One file per request, as multipart form data: `file` and `slot`.
export const POST: APIRoute = async ({ request, url }) => {
  if (request.headers.get("origin") !== url.origin) return fail("The request came from the wrong origin. Upload from the /admin page.", 403);
  // The largest file is a 25 MB video. Refuse a bigger body before reading it.
  if (Number(request.headers.get("content-length") ?? 0) > 26 * 1024 * 1024) {
    return fail("The file is too large. Videos can be 25 MB at most and images 5 MB. Compress it and upload again.", 413);
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const slot = Slot.safeParse(form?.get("slot"));
  if (!(file instanceof File) || !slot.success) return fail("The request is not valid. Reload the page and try again.", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes, slot.data);
  if (!check.ok) return fail(check.error, 400);
  const key = await putMedia(env.MEDIA, bytes, check.ext);
  return Response.json({ key, kind: check.kind });
};
