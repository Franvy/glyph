import { env, waitUntil } from "cloudflare:workers";
import { type DuolingoProfile, getDuolingo } from "@/lib/duolingo";
import { sampleDuolingo } from "@/lib/site";

/**
 * The Duolingo streak card on /, under the mark in the intro. The row is stored in D1 and refreshed in the background
 * (src/lib/duolingo.ts). The E2E build shows a fixed sample instead.
 * Null when there is no username, or when Duolingo has not answered once: the card then shows the link only.
 */
export async function homeDuolingo(username: string | undefined): Promise<DuolingoProfile | null> {
  if (!username) return null;
  if (import.meta.env.E2E_FIXTURES) return { ...sampleDuolingo, username };
  return getDuolingo(env.DB, { username, now: Date.now(), defer: waitUntil });
}
