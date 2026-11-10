import { expect, test } from "@playwright/test";

test("the avatar reveals color under the pointer", async ({ page }) => {
  await page.goto("/");
  const avatar = page.getByRole("img", { name: "A hand-painted Pikachu in the grass" });
  const color = page.locator(".avatar-spotlight");

  await expect(color).toBeHidden();
  await avatar.hover({ position: { x: 20, y: 25 } });
  await expect(color).toBeVisible();
  await expect(color).toHaveCSS("--spotlight-x", "20px");
  await expect(color).toHaveCSS("--spotlight-y", "25px");

  await avatar.hover({ position: { x: 55, y: 50 } });
  await expect(color).toHaveCSS("--spotlight-x", "55px");
  await expect(color).toHaveCSS("--spotlight-y", "50px");

  await page.mouse.move(0, 0);
  await expect(color).toBeHidden();
});
