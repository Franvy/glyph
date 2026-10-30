import { expect, test } from "@playwright/test";

// The live weather is off here: no test depends on a weather service being up.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/weather", (route) => route.fulfill({ status: 503, json: { error: "Off in this test." } }));
});

test("home renders every section", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Franvy" })).toBeVisible();
  for (const name of ["Projects", "Skills & Technologies"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expect(page.locator(".project")).toHaveCount(4);
  await expect(page.getByRole("figure", { name: /contributions in the last year/ })).toBeVisible();
});

test("index.md serves the page as markdown", async ({ request }) => {
  const res = await request.get("/index.md");
  expect(res.headers()["content-type"]).toContain("text/markdown");
  expect(await res.text()).toMatch(/^# Franvy\n/);
});

test("the Ignite card shows its drawing and a Dev status", async ({ page }) => {
  await page.goto("/");
  const ignite = page.locator(".project", { hasText: "Ignite" });
  await ignite.scrollIntoViewIfNeeded();
  await expect(ignite.locator('[data-figure="ignite"] svg')).toBeVisible();
  await expect(ignite).toContainText("Dev");
  // Its source is not public yet: a greyed-out GitHub mark that links nowhere.
  await expect(ignite.getByRole("img", { name: "GitHub: not public yet" })).toBeVisible();
  await expect(ignite.getByRole("link", { name: "GitHub", exact: true })).toHaveCount(0);
});

test("a project card shows a mark for each of its links: the website, GitHub or both", async ({ page }) => {
  await page.goto("/");
  // The sample projects in src/lib/site.ts: limns.cc and limns.dev have only a website, Gtab has only GitHub.
  for (const [name, href] of [["limns.cc", "https://limns.cc"], ["limns.dev", "https://limns.dev"]]) {
    const siteOnly = page.locator(".project", { hasText: name });
    await siteOnly.scrollIntoViewIfNeeded(); // client:visible
    await expect(siteOnly.getByRole("link", { name: "Website", exact: true })).toHaveAttribute("href", href);
    await expect(siteOnly.getByRole("link", { name: "GitHub", exact: true })).toHaveCount(0);
  }
  const githubOnly = page.locator(".project", { hasText: "Gtab" });
  await githubOnly.scrollIntoViewIfNeeded();
  await expect(githubOnly.getByRole("link", { name: "Website", exact: true })).toHaveCount(0);
  await expect(githubOnly.getByRole("link", { name: "GitHub", exact: true })).toHaveAttribute("href", "https://github.com/Franvy/gtab");
});

test("the contact buttons: book an intro call on Cal.com, or send an email", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Send an email", exact: true })).toHaveAttribute("href", /^mailto:/);
  await expect(page.getByRole("link", { name: "Book an intro call" })).toHaveAttribute("href", "https://cal.com/franvy");
});

test("on a phone the column sits inside a visible rail, with a 24px gutter", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  // Paper: Home · v7 mobile 390 · inset rail. The rail is 8px in from the screen edge, the text 16px in from the rail.
  const rail = await page.locator("#about > .rail").boundingBox();
  expect(rail?.x).toBe(8);
  expect(rail?.width).toBe(374);
  const text = await page.locator("#about p").first().boundingBox();
  expect(text?.x).toBe(24);
  // The two contact buttons do not fit side by side: each takes a full row, on one line.
  for (const name of ["Book an intro call", "Send an email"]) {
    const button = await page.getByRole("link", { name, exact: true }).boundingBox();
    expect(button?.width).toBe(342);
    expect(button?.height).toBe(38);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
