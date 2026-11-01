import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.route("**/api/weather", (route) => route.fulfill({ status: 503, json: { error: "Off in this test." } }));
});

test("Halloween can be previewed and reached with the scene switch", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?festival=halloween");
  await expect(page.locator("html")).toHaveAttribute("data-festival", "halloween");
  await expect(page.locator("canvas[data-weather=halloween]")).toBeVisible();
  await page.getByRole("button", { name: /^Banner theme: Halloween/ }).click();
  await expect(page.locator("canvas[data-weather=clear]")).toBeVisible();
});

test("keyboard actions work with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?festival=halloween");
  const canvas = page.locator("canvas[data-weather=halloween]");
  await expect(canvas).toHaveAttribute("data-state", "still");
  const pumpkin = page.getByRole("button", { name: "Toggle pumpkin lights" });
  const before = await pumpkin.getAttribute("aria-pressed");
  await pumpkin.focus();
  await pumpkin.press("Enter");
  await expect(pumpkin).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
  const pet = page.getByRole("button", { name: "Pet Meiqiu", exact: true });
  await pet.focus();
  await pet.press("Space");
  await expect(canvas).toHaveAttribute("data-cat-mode", "happy");
  const ghost = page.getByRole("button", { name: "Summon a ghost" });
  await ghost.focus();
  await ghost.press("Enter");
  await expect(canvas).toHaveAttribute("data-ghost", "true");
  await ghost.press("Enter");
  await expect(canvas).toHaveAttribute("data-ghost", "false");
});

test("a returning tab re-evaluates the Shanghai date without a reload", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-10-30T16:00:00Z"));
  await page.goto("/");
  await expect(page.locator("canvas[data-weather=halloween]")).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-10-31T16:00:00Z"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.locator("html")).not.toHaveAttribute("data-festival");
  await expect(page.locator("canvas[data-weather=clear]")).toBeVisible();
});

test.describe("touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("the small pumpkin has a touch target beyond its visible pixels", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?festival=halloween");
    const canvas = page.locator("canvas[data-weather=halloween]");
    await expect(canvas).toHaveAttribute("data-state", "still");
    const box = (await canvas.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width - 5, box.y + box.height * 58 / 74 - 12);
    await expect(canvas).toHaveAttribute("data-pumpkin-lit", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });
});
