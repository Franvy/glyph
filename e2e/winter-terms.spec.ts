import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.route("**/api/weather", (route) => route.fulfill({ status: 503, json: { error: "Off in this test." } }));
});

test("winter solar terms can be previewed and cycled via the banner switch", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?festival=minor-snow");
  await expect(page.locator("html")).toHaveAttribute("data-festival", "minor-snow");
  await expect(page.locator("canvas[data-weather=minor-snow]")).toBeVisible();

  await page.getByRole("button", { name: /^Banner theme: Minor Snow/ }).click();
  await expect(page.locator("canvas[data-weather=major-snow]")).toBeVisible();

  await page.getByRole("button", { name: /^Banner theme: Major Snow/ }).click();
  await expect(page.locator("canvas[data-weather=winter-solstice]")).toBeVisible();

  await page.getByRole("button", { name: /^Banner theme: Winter Solstice/ }).click();
  await expect(page.locator("canvas[data-weather=clear]")).toBeVisible();
});

test("Minor Snow keyboard controls work and enforce the reserve rule", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?festival=minor-snow");
  const canvas = page.locator("canvas[data-weather=minor-snow]");
  await expect(canvas).toHaveAttribute("data-state", "still");

  const brazier = page.getByRole("button", { name: "Fan the brazier" });
  await brazier.focus();
  await brazier.press("Enter");
  await expect(canvas).toHaveAttribute("data-brazier-fanned", "true");
  await expect(brazier).toHaveAttribute("aria-pressed", "true");

  const bough = page.getByRole("button", { name: "Shake persimmon bough" });
  await bough.focus();
  for (let i = 0; i < 4; i++) await bough.press("Space");
  await expect(canvas).toHaveAttribute("data-persimmons-dropped", "3");
});

test("Major Snow keyboard controls cycle snow-Meiqiu and chime icicles", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?festival=major-snow");
  const canvas = page.locator("canvas[data-weather=major-snow]");
  await expect(canvas).toHaveAttribute("data-snow-cat-stage", "3");

  const build = page.getByRole("button", { name: "Build snow-cat" });
  await build.focus();
  await build.press("Enter");
  await expect(canvas).toHaveAttribute("data-snow-cat-stage", "1");
  await build.press("Enter");
  await expect(canvas).toHaveAttribute("data-snow-cat-stage", "2");

  const icicles = page.getByRole("button", { name: "Chime eave icicles" });
  await icicles.focus();
  await icicles.press("Space");
  await expect(canvas).toHaveAttribute("data-icicle-glint", "true");
});

test("Winter Solstice keyboard controls stoke the hearth and bloom wintersweet", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?festival=winter-solstice");
  const canvas = page.locator("canvas[data-weather=winter-solstice]");
  await expect(canvas).toHaveAttribute("data-wintersweet-blooms", "5");

  const hearth = page.getByRole("button", { name: "Stoke the hearth" });
  await hearth.focus();
  await hearth.press("Enter");
  await expect(canvas).toHaveAttribute("data-hearth-stoked", "true");
  await expect(hearth).toHaveAttribute("aria-pressed", "true");

  const bloom = page.getByRole("button", { name: "Bloom wintersweet" });
  await bloom.focus();
  await bloom.press("Space");
  await expect(canvas).toHaveAttribute("data-wintersweet-blooms", "6");
});
