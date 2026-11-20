import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/weather", (route) => route.fulfill({ status: 503, json: { error: "Off in this test." } }));
});

test("clicking the yarn ball wakes the cat and reacts immediately", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const stage = page.getByTestId("meiqiu-stage");
  await stage.scrollIntoViewIfNeeded();
  const ball = stage.locator(".mq-ball");
  await expect(ball).toBeVisible();

  await ball.click();

  await expect(stage.locator(".mq-bubble.mq-loud").first()).toHaveText("!");
});

test("the yarn ball does not stick to the pointer when mouse buttons are released", async ({ page }) => {
  await page.goto("/");
  const stage = page.getByTestId("meiqiu-stage");
  await stage.scrollIntoViewIfNeeded();
  const ball = stage.locator(".mq-ball");
  await expect(ball).toBeVisible();

  const stageBox = await stage.boundingBox();
  const ballBox = await ball.boundingBox();
  expect(stageBox).not.toBeNull();
  expect(ballBox).not.toBeNull();

  // Press on the ball, then simulate a lost pointerup: a mouse move arrives with buttons === 0.
  await ball.dispatchEvent("pointerdown", {
    button: 0,
    buttons: 1,
    pointerId: 1,
    pointerType: "mouse",
    clientX: ballBox!.x + ballBox!.width / 2,
    clientY: ballBox!.y + ballBox!.height / 2,
  });

  const targetX = stageBox!.x + 80;
  const targetY = stageBox!.y + 30;
  await ball.dispatchEvent("pointermove", {
    buttons: 0,
    pointerId: 1,
    pointerType: "mouse",
    clientX: targetX,
    clientY: targetY,
  });

  const after = await ball.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.x - targetX)).toBeGreaterThan(40);
});
