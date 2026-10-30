import { defineConfig, devices } from "@playwright/test";

// Runs against `pnpm preview`: the build, in workerd, on the local D1.
export default defineConfig({
  testDir: "./e2e", // e2e/*.spec.ts only
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A smoke suite: links, counts, access and fonts. No screenshots, and no test that waits on an animation.
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // --ignore-lock keeps preview in the foreground; Astro otherwise backgrounds it when an AI agent runs the tests.
    // E2E_FIXTURES=1 draws sample contribution counts instead of asking GitHub. The deploy build leaves it off.
    command: "E2E_FIXTURES=1 pnpm build && pnpm astro preview --ignore-lock",
    url: "http://localhost:4321",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
