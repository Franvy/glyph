import { env, waitUntil } from "cloudflare:workers";
import { type ContributionYear, yearFromDays } from "@/lib/contributions";
import { getCalendar } from "@/lib/github";
import { githubLogin, sampleContributions } from "@/lib/site";

/**
 * The contribution calendar for / and /index.md. The days are stored in D1 and refreshed
 * in the background (src/lib/github.ts). The E2E build shows fixed sample counts instead.
 * With no days yet, the calendar is empty and ends today in Shanghai (UTC+8).
 */
export async function homeContributions(): Promise<ContributionYear> {
  if (import.meta.env.E2E_FIXTURES) return sampleContributions;
  const now = Date.now();
  const days = await getCalendar(env.DB, { token: env.GITHUB_TOKEN, login: githubLogin, now, defer: waitUntil });
  return yearFromDays(days, new Date(now + 8 * 3600_000));
}
