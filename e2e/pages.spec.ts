import { expect, test } from "@playwright/test";

test("the writing pages are gone", async ({ page, request }) => {
  for (const path of ["/posts/hello-world/", "/rss.xml", "/api/likes?slug=hello-world"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
  await page.goto("/");
  await expect(page.locator('link[type="application/rss+xml"]')).toHaveCount(0);
});

test("an unknown page is a 404 with a way home", async ({ page }) => {
  const res = await page.goto("/no-such-page/");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "franvy.cc" })).toBeVisible();
});

// Sentences are set in Inter. Labels, numbers, code and ASCII art stay in Paper Mono.
test("prose is in Inter, and the frame stays in Paper Mono", async ({ page }) => {
  const family = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).fontFamily);

  await page.goto("/");
  expect(await family("h1")).toMatch(/Inter/);
  expect(await family("#about p")).toMatch(/Inter/);
  expect(await family(".project p")).toMatch(/Inter/);
  expect(await family("h2#projects")).toMatch(/Paper Mono/);
  expect(await family(".project h3")).toMatch(/Paper Mono/);
  expect(await family("#contributions figure")).toMatch(/Paper Mono/);
});

// The Paper file sets Inter with cv01 and Paper Mono without it. In Paper Mono, cv01 swaps the "a".
test("only Inter uses cv01, and every font file loads", async ({ page }) => {
  const features = (selector: string) =>
    page.locator(selector).first().evaluate((el) => getComputedStyle(el).fontFeatureSettings);

  await page.goto("/");
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === "error").map((f) => `${f.family} ${f.weight}`);
  });
  expect(fonts).toEqual([]);
  expect(await features("h1")).toContain("cv01");
  expect(await features("#about p")).toContain("cv01");
  expect(await features("h2#projects")).toBe("normal");
  expect(await features(".project h3")).toBe("normal");
  expect(await features("#contributions figure")).toBe("normal");
});

test("the home page is titled Franvy and has the avatar icon",async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Franvy");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.png");
  expect((await request.get("/favicon.png")).headers()["content-type"]).toBe("image/png");
  expect((await request.get("/apple-touch-icon.png")).status()).toBe(200);
});
