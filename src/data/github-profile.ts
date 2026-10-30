import { env, waitUntil } from "cloudflare:workers";
import { type GitHubProfile, getProfile } from "@/lib/github-profile";
import { githubLogin, sampleProfile } from "@/lib/site";

/**
 * The GitHub hover card on /: name, stars, followers and badges. The row is stored in D1 and refreshed
 * in the background (src/lib/github-profile.ts). The E2E build shows a fixed sample instead.
 * Null when there is no token and nothing is stored: the card then shows the contributions only.
 */
export async function homeGitHub(): Promise<GitHubProfile | null> {
  if (import.meta.env.E2E_FIXTURES) return sampleProfile;
  return getProfile(env.DB, { token: env.GITHUB_TOKEN, login: githubLogin, now: Date.now(), defer: waitUntil });
}
