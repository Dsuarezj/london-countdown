import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    localStorage.setItem("install-prompt", JSON.stringify({ installed: true }));
    localStorage.setItem("trip-language", "es");
  });
  await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseURL).origin
    ? route.fallback()
    : route.abort());
  await page.route("**/config.json", async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.meeting.date = "2026-11-13";
    config.meeting.time = "22:00";
    config.meeting.end = { date: "2026-11-15", time: "10:00" };
    config.backgrounds.weather = false;
    await route.fulfill({ json: config });
  });
});

async function openAt(page, date) {
  await page.clock.install({ time: new Date(date) });
  await page.clock.pauseAt(new Date(date));
  await page.goto("/");
  await expect(page.locator(".bird")).toHaveCount(2);
  await expect(page.locator("body")).toHaveClass(/journey|arrived/);
}

test("zero crossfades in place, starts hearts first and cancels an unfinished flight", async ({ page }) => {
  await openAt(page, "2026-11-13T21:59:59.500Z");
  await expect(page.locator("body")).toHaveClass(/journey/);
  const before = await page.locator("#countdownScene").boundingBox();
  await page.clock.runFor(1000);
  await expect(page.locator("body")).toHaveAttribute("data-trip-phase", "together");
  await expect(page.locator("body")).not.toHaveClass(/journey/);
  await expect(page.locator(".together__heart")).toHaveCount(10);
  await expect(page.locator("body")).toHaveClass("arrived");
  await expect(page.locator("#seconds")).toHaveText("00");
  await expect(page.locator("#countdownPanel")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#countdownPanel")).toHaveCSS("transition-duration", "1.4s, 1.4s, 1.4s");
  const after = await page.locator("#countdownScene").boundingBox();
  expect(after.height).toBeCloseTo(before.height, 0);
  const midFade = await page.locator("#countdownPanel").evaluate((panel) => {
    const fade = panel.getAnimations().find((animation) => animation.transitionProperty === "opacity");
    if (!fade) {
      throw new Error("The countdown must fade out, not disappear immediately.");
    }
    fade.pause();
    fade.currentTime = 700;
    return Number(getComputedStyle(panel).opacity);
  });
  expect(midFade).toBeGreaterThan(0);
  expect(midFade).toBeLessThan(1);
  await expect(page.locator("#reunion")).toHaveText("Ya están las dos aquí.");
  await page.clock.runFor(10000);
  await expect(page.locator("body")).not.toHaveClass(/journey/);
  await expect(page.locator(".together")).toHaveCount(0);
});

test("opening during the stay skips travel and shows hearts before affection", async ({ page }) => {
  await openAt(page, "2026-11-14T12:00:00Z");
  await expect(page.locator("body")).toHaveClass("arrived");
  await expect(page.locator("body")).toHaveAttribute("data-trip-phase", "together");
  await expect(page.locator(".together__heart")).toHaveCount(10);
  await expect(page.locator("#sky")).toHaveClass(/sky--meeting-city/);
  await expect(page.locator("#meetingSchedule")).toBeHidden();
  await expect(page.locator("#tripNote")).toHaveText("Ahora el tiempo se cuenta en momentos juntas.");
  await page.locator(".pin--north").click();
  await expect(page.locator("#infoCardLocation")).toHaveText("Ubicación actual: Londres");
});

test("Sunday at 10 changes to a lasting memory scene without another celebration", async ({ page }) => {
  await openAt(page, "2026-11-15T09:59:59.500Z");
  await page.clock.runFor(1000);
  await expect(page.locator("body")).toHaveAttribute("data-trip-phase", "memories");
  await expect(page.locator(".headline")).toBeHidden();
  await expect(page.locator("#countdownScene")).toBeHidden();
  await expect(page.locator("#sky")).toHaveClass(/sky--origin-weather/);
  await expect(page.locator(".hemisphere--north")).toHaveAttribute("data-night-sky", "aurora");
  await expect(page.locator(".hemisphere--south")).toHaveAttribute("data-night-sky", "stars");
  await expect(page.locator(".together")).toHaveCount(0);
  await page.clock.runFor(10000);
  await expect(page.locator(".together")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-trip-phase", "memories");
  await expect(page.locator("body")).not.toHaveClass(/journey/);
  await expect(page.locator(".together")).toHaveCount(0);
  await expect(page.locator(".headline")).toBeHidden();
  await expect(page.locator("#countdownScene")).toBeHidden();
  await expect(page.locator("#sky")).toHaveClass(/sky--origin-weather/);
});

for (const viewport of [{ width: 320, height: 360 }, { width: 667, height: 375 }]) {
  test(`memories put each bird back at its corner at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openAt(page, "2026-11-16T12:00:00Z");
    await expect(page.locator(".headline")).toBeHidden();
    await expect(page.locator("#countdownScene")).toBeHidden();
    const north = await page.locator(".bird--north").boundingBox();
    const south = await page.locator(".bird--south").boundingBox();
    expect(north.x + north.width).toBeLessThan(viewport.width / 2);
    expect(north.y + north.height).toBeLessThan(viewport.height / 2);
    expect(south.x).toBeGreaterThan(viewport.width / 2);
    expect(south.y).toBeGreaterThan(viewport.height / 2);
    await expect(page.locator(".bird--north")).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".bird--south")).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await page.screenshot({ path: testInfo.outputPath("memory.png"), animations: "disabled" });
  });
}

test("a bird occasionally glides along its own corner in memories", async ({ page }) => {
  await openAt(page, "2026-11-16T12:00:00Z");
  const body = page.locator("body");
  for (let second = 0; second < 40 && !(await body.evaluate((element) => /flyby-/.test(element.className))); second++) {
    await page.clock.runFor(1000);
  }
  await expect(body).toHaveClass(/flyby-(north|south)/);
  await page.clock.runFor(7000);
  await expect(page.locator("body")).not.toHaveClass(/flyby-/);
});

test("reduced motion skips flights, hearts and the countdown transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAt(page, "2026-11-13T21:59:59.500Z");
  await page.clock.runFor(1000);
  await expect(page.locator("body")).not.toHaveClass(/journey/);
  await expect(page.locator(".together")).toHaveCount(0);
  await expect(page.locator("#countdownPanel")).toHaveCSS("transition-duration", "0s");
  await expect(page.locator(".bird--north")).toHaveCSS("animation-name", "none");
  await expect(page.locator("#reunion")).toBeVisible();
});
