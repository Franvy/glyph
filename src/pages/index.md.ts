import { env } from "cloudflare:workers";
import { homeContributions } from "@/data/contributions";
import { getContent } from "@/lib/content";
import { homeMarkdown } from "@/lib/markdown";

// On demand, like the home page: it reads the content edited in /admin from D1.
export const prerender = false;

// The home page as markdown for readers and agents.
export async function GET() {
  const [content, contributions] = await Promise.all([getContent(env.DB), homeContributions()]);
  return new Response(homeMarkdown(content, contributions), { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
