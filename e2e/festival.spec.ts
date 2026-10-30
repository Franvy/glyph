import { expect, test } from "@playwright/test";

// The layout marks a festival day with <html data-festival="...">. The date is read in Shanghai.
test("a festival day sets data-festival on every page", async ({ page }) => {
  // 00:30 on 25 Sep 2026 in Shanghai: Mid-Autumn. It is still the 24th in UTC.
  await page.clock.setFixedTime(new Date("2026-09-24T16:30:00Z"));
  for (const path of ["/", "/no-such-page/"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-festival", "mid-autumn");
  }
});

test("an ordinary day has no data-festival", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-22T04:00:00Z"));
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-festival");
});

test("?festival= previews a theme, and ?festival=none turns it off", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-22T04:00:00Z"));
  await page.goto("/?festival=spring-festival");
  await expect(page.locator("html")).toHaveAttribute("data-festival", "spring-festival");

  await page.goto("/?festival=not-a-festival");
  await expect(page.locator("html")).not.toHaveAttribute("data-festival");

  await page.clock.setFixedTime(new Date("2026-09-24T16:30:00Z"));
  await page.goto("/?festival=none");
  await expect(page.locator("html")).not.toHaveAttribute("data-festival");
});
