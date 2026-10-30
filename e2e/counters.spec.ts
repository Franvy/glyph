import { expect, test, type APIRequestContext } from "@playwright/test";

// The counters in the footer: page views and pets of Meiqiu, the footer cat. They live in D1.
const totals = async (request: APIRequestContext) =>
  (await (await request.get("/api/counters")).json()) as { views: number; pets: number };

test("each page view is counted", async ({ page, request }) => {
  const before = (await totals(request)).views;
  await page.goto("/");
  await expect.poll(async () => (await totals(request)).views).toBeGreaterThan(before);
});

test("pets are counted, and the count is kept", async ({ request }) => {
  const before = (await totals(request)).pets;
  const res = await request.post("/api/counters", { data: { name: "pets", by: 2 } });
  expect(res.ok()).toBe(true);
  expect((await totals(request)).pets).toBe(before + 2);
});

test("the counters API refuses bad input", async ({ request }) => {
  expect((await request.post("/api/counters", { data: { name: "likes" } })).status()).toBe(400);
  expect((await request.post("/api/counters", { data: { name: "pets", by: 500 } })).status()).toBe(400);
  expect((await request.post("/api/counters", { data: "junk" })).status()).toBe(400);
});
