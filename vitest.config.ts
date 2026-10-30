// Plain Vitest, not getViteConfig: the Cloudflare adapter stays out of the tests.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"], // e2e/ belongs to Playwright
  },
});
