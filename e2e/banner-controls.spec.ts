import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.route("**/api/weather", (route) => route.fulfill({ status: 503, json: { error: "Off in this test." } }));
});

test("base garden keyboard controls work with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?festival=none");
  const canvas = page.locator("canvas[data-weather=clear]");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-state", "still");

  const pet = page.getByRole("button", { name: "Pet Meiqiu", exact: true });
  await pet.focus();
  await pet.press("Space");
  await expect(canvas).toHaveAttribute("data-cat-mode", "happy");

  const house = page.getByRole("button", { name: "Warm the house" });
  await house.focus();
  await house.press("Enter");
  await expect(canvas).toHaveAttribute("data-house-warm", "true");
  await expect(house).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toHaveAttribute("data-cat-mode", "sleep");

  const beforeYarn = await canvas.getAttribute("data-yarn-x");
  const yarn = page.getByRole("button", { name: "Roll yarn" });
  await yarn.focus();
  await yarn.press("Enter");
  await expect(canvas).toHaveAttribute("data-cat-mode", "alert");
  expect(await canvas.getAttribute("data-yarn-x")).not.toBe(beforeYarn);
});

test("Spring Festival keyboard controls pet, pop firecrackers, and launch a firework", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?festival=spring-festival");
  const canvas = page.locator("canvas[data-weather=spring]");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-state", "still");

  const pet = page.getByRole("button", { name: "Pet Meiqiu", exact: true });
  await pet.focus();
  await pet.press("Enter");
  await expect(canvas).toHaveAttribute("data-cat-mode", "happy");

  const crackers = page.getByRole("button", { name: "Light firecrackers" });
  await crackers.focus();
  await crackers.press("Space");
  await expect(canvas).toHaveAttribute("data-crackers-popped", "6");

  const firework = page.getByRole("button", { name: "Launch firework" });
  await firework.focus();
  await firework.press("Enter");
  await expect(canvas).toHaveAttribute("data-fireworks", "1");
});
