import { expect, test } from "@playwright/test";

// The preview build runs like production: without a valid Cloudflare Access token, nothing in admin answers.
test("the admin page and API refuse a request without Access", async ({ request }) => {
  for (const path of ["/admin", "/admin/", "/api/admin/content"]) {
    expect((await request.get(path)).status(), path).toBe(403);
  }
  // Other spellings are either refused or not a route at all: never the editor.
  for (const path of ["/ADMIN", "/%61dmin", "/Api/Admin/content"]) {
    expect((await request.get(path)).ok(), path).toBe(false);
  }
  const forged = await request.put("/api/admin/content", {
    headers: { "cf-access-jwt-assertion": "a.b.c", origin: "http://localhost:4321" },
    data: { section: "skills", data: ["hacked"] },
  });
  expect(forged.status()).toBe(403);
  const upload = await request.post("/api/admin/media", {
    headers: { origin: "http://localhost:4321" },
    multipart: { slot: "project", file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("png") } },
  });
  expect(upload.status()).toBe(403);
  expect(await (await request.get("/index.md")).text()).not.toContain("hacked");
});

test("the admin page is not in the sitemap", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap-0.xml")).text();
  expect(sitemap).not.toContain("/admin");
});

test("media serves only uploaded keys", async ({ request }) => {
  expect((await request.get(`/media/${"0".repeat(64)}.png`)).status()).toBe(404);
  expect((await request.get("/media/not-a-key.svg")).status()).toBe(404);
});
