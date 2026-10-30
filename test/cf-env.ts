import { existsSync, readdirSync, readFileSync } from "node:fs";
import { getPlatformProxy } from "wrangler";

// One per test file: reads the bindings in wrangler.jsonc and starts a local D1 that is never written to disk.
export const proxy = await getPlatformProxy<Env>({ persist: false });
export const db = proxy.env.DB; // pass straight to the src/lib functions

// Apply the same SQL that wrangler applies (drizzle-kit 0.31's flat layout).
const files = existsSync("migrations")
  ? readdirSync("migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort()
  : [];
for (const f of files) {
  const sql = readFileSync(`migrations/${f}`, "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) await db.prepare(statement).run();
  }
}
