import { expect, test } from "@playwright/test";

test("/api/weather gives a reading or says why not", async ({ request }) => {
  const res = await request.get("/api/weather");
  const body = await res.json();
  if (res.ok()) {
    expect(body.city).toBe("Hangzhou");
    expect(typeof body.temperature).toBe("number");
    expect(res.headers()["cache-control"]).toContain("max-age=900");
  } else {
    expect(res.status()).toBe(503);
    expect(body.error).toMatch(/\.$/);
  }
});
