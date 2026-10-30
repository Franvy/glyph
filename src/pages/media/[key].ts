import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { serveMedia } from "@/lib/media";

export const prerender = false; // reads R2

// Files uploaded in /admin. Public: the home page shows them.
export const GET: APIRoute = ({ params, request }) => serveMedia(env.MEDIA, params.key ?? "", request);
