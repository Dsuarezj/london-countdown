import { expect, test } from "@playwright/test";
import { weatherResponse } from "../weather-fixture.js";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("install-prompt", JSON.stringify({ installed: true })));
  await page.route("**/*", (route) => new URL(route.request().url()).origin === "http://127.0.0.1:4173"
    ? route.fallback()
    : route.abort());
  await page.route("https://api.open-meteo.com/**", (route) => route.fulfill({ json: weatherResponse() }));
});

test("new affection beats animate their own layers without overlapping", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveClass(/journey/);
  await expect(page.locator(".bird")).toHaveCount(2);
  await page.locator("body").evaluate((body) => {
    body.classList.remove("journey");
    body.classList.add("arrived");
  });

  for (const [beat, selector, animationName] of [
    ["wing-greeting", ".bird--north .wing--reach", "wing-wave-north"],
    ["double-hop", ".bird--south .bird__body", "hop-south"],
    ["heart-beat", ".heart", "heart-beat"]
  ]) {
    await page.locator("body").evaluate((body, className) => body.classList.add(className), beat);
    await expect(page.locator(selector)).toHaveCSS("animation-name", animationName);
    await page.locator("body").evaluate((body, className) => body.classList.remove(className), beat);
  }
});

test("new affection beats respect reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("body")).toHaveClass(/arrived/);
  await expect(page.locator(".bird")).toHaveCount(2);

  for (const [beat, selector] of [
    ["wing-greeting", ".bird--north .wing--reach"],
    ["double-hop", ".bird--south .bird__body"],
    ["heart-beat", ".heart"]
  ]) {
    await page.locator("body").evaluate((body, className) => body.classList.add(className), beat);
    await expect(page.locator(selector)).toHaveCSS("animation-name", "none");
    await page.locator("body").evaluate((body, className) => body.classList.remove(className), beat);
  }
});
