import { defineConfig } from "drizzle-kit";

// Only `drizzle-kit generate` reads this. wrangler applies the SQL in migrations/.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./migrations",
});
