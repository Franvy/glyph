import { expect, test } from "@playwright/test";

test("Lunar New Year paper stays in its own scene", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/?festival=spring-festival");

  const canvas = page.locator('canvas[data-scene="garden"]');
  await expect(canvas).toHaveAttribute("data-state", "running");
  const box = (await canvas.boundingBox())!;
  const width = await canvas.evaluate((el: HTMLCanvasElement) => el.width);
  const column = Math.floor(width / 2);
  const paperInColumn = () =>
    canvas.evaluate((el: HTMLCanvasElement, x) => {
      const pixels = el.getContext("2d")!.getImageData(x, 0, 1, el.height).data;
      for (let i = 0; i < pixels.length; i += 4) {
        // The daylight red paper color.
        if (pixels[i] === 224 && pixels[i + 1] === 65 && pixels[i + 2] === 47) return true;
      }
      return false;
    }, column);

  await canvas.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * column / width,
    clientY: box.y + box.height / 5,
  });
  // Draw the paper without the scene transition or an animation delay.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(canvas).toHaveAttribute("data-state", "still");
  expect(await paperInColumn()).toBe(true);

  await page.getByRole("button", { name: /^Banner theme: Lunar New Year/ }).click();
  await expect(canvas).toHaveAttribute("data-weather", "halloween");
  expect(await paperInColumn()).toBe(false);
});
