import { expect, test } from "@playwright/test";
import { weatherResponse } from "../weather-fixture.js";

test.beforeEach(async ({ page, baseURL }) => {
  await page.clock.setFixedTime(new Date("2026-10-18T09:15:00Z"));
  await page.addInitScript(() => localStorage.setItem("install-prompt", JSON.stringify({ installed: true })));
  await page.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseURL).origin
    ? route.fallback()
    : route.abort());
});

async function showWeather(page, current, { background = "origin-weather" } = {}) {
  await page.route("**/config.json", async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.backgrounds = { ...config.backgrounds, fixed: background, countdown: [], meetingDay: "", weather: true };
    await route.fulfill({ json: config });
  });
  await page.route("https://api.open-meteo.com/**", (route) => {
    const latitude = Number(new URL(route.request().url()).searchParams.get("latitude"));
    return route.fulfill({ json: weatherResponse(latitude > 60 || background === "meeting-city" ? current : {}) });
  });
  await page.goto("/?weatherDebug");
  await expect(page.locator("#city")).not.toHaveText("");
  const scene = page.locator(background === "meeting-city" ? ".weather" : ".hemisphere--north");
  await expect(scene).toHaveAttribute("data-cloud-cover-pct", String(current.cloud_cover ?? 0));
  return scene;
}

async function recordRendering(scene, current, testInfo) {
  const painted = await scene.evaluate((element) => {
    const style = (selector) => getComputedStyle(element.querySelector(selector));
    return {
      phase: element.dataset.phase,
      cloudCoverPct: element.dataset.cloudCoverPct,
      rainMmPerHour: element.dataset.rainMmPerHour,
      snowfallCmPerHour: element.dataset.snowfallCmPerHour,
      cloudOpacity: style(".cloud-cover").opacity,
      cloudVeilOpacity: style(".cloud-veil").opacity,
      rainOpacity: style(".rain").opacity,
      rainAnimation: style(".rain").animationName,
      rainFilter: style(".rain").filter,
      snowOpacity: style(".snow").opacity,
      snowAnimation: style(".snow").animationName,
      thunderOpacity: style(".thunder").opacity,
      lightning: getComputedStyle(element.querySelector(".thunder"), "::before").animationName,
      stars: style(".stars").filter
    };
  });
  const comparison = { api: weatherResponse(current), painted };
  console.log(`[weather QA] ${testInfo.title}\n${JSON.stringify(comparison, null, 2)}`);
  await testInfo.attach("API vs painted", { body: JSON.stringify(comparison, null, 2), contentType: "application/json" });
  await testInfo.attach("Weather screenshot", {
    body: await scene.page().screenshot({ path: testInfo.outputPath("weather.png") }),
    contentType: "image/png"
  });
  return painted;
}

const scenarios = [
  { name: "clear day", current: { cloud_cover: 0 }, cloud: "0", veil: "0", rain: "0", snow: "0", thunder: "0" },
  { name: "overcast without precipitation", current: { cloud_cover: 100, weather_code: 3 }, cloud: "0.7", veil: "0.6", rain: "0", snow: "0", thunder: "0" },
  { name: "rain with openings in the clouds", current: { cloud_cover: 40, weather_code: 61, rain: 0.25, showers: 0.5 }, cloud: "0.38", veil: "0.24", rain: "0.88", snow: "0", thunder: "0" },
  { name: "snow without rain", current: { cloud_cover: 80, weather_code: 73, snowfall: 0.5 }, cloud: "0.56", veil: "0.48", rain: "0", snow: "0.9", thunder: "0" },
  { name: "rain, snow and thunder together", current: { cloud_cover: 100, weather_code: 97, rain: 0.75, snowfall: 0.5 }, cloud: "0.95", veil: "0.6", rain: "0.88", snow: "0.9", thunder: "0.55" },
  { name: "rain code with zero precipitation", current: { cloud_cover: 40, weather_code: 61 }, cloud: "0.28", veil: "0.24", rain: "0", snow: "0", thunder: "0" }
];

for (const scenario of scenarios) {
  test(`renders ${scenario.name} from API values`, async ({ page }, testInfo) => {
    const scene = await showWeather(page, scenario.current);
    await expect(scene.locator(".daylight")).toHaveCSS("opacity", "1");
    await expect(scene.locator(".cloud-cover")).toHaveCSS("opacity", scenario.cloud);
    await expect(scene.locator(".cloud-veil")).toHaveCSS("opacity", scenario.veil);
    await expect(scene.locator(".rain")).toHaveCSS("opacity", scenario.rain);
    await expect(scene.locator(".snow")).toHaveCSS("opacity", scenario.snow);
    await expect(scene.locator(".thunder")).toHaveCSS("opacity", scenario.thunder);
    if (scenario.rain !== "0") {
      await expect(scene.locator(".rain")).toHaveCSS("animation-name", "rainfall");
      await expect(scene.locator(".rain")).toHaveCSS("background-image", /repeating-linear-gradient/);
    }
    if (scenario.snow !== "0") {
      await expect(scene.locator(".snow")).toHaveCSS("animation-name", "snowfall");
      await expect(scene.locator(".snow")).toHaveCSS("background-image", /data:image\/svg\+xml/);
    }
    const painted = await recordRendering(scene, scenario.current, testInfo);
    expect(painted.lightning).toBe(scenario.thunder === "0" ? "none" : "lightning");
    if (scenario.name === "rain, snow and thunder together") {
      await expect(page.locator("#sky")).toHaveScreenshot("mixed-storm.png", {
        animations: "disabled",
        style: ".stage, .pins, .topbar, .route, .install-prompt { visibility: hidden !important; }",
        maxDiffPixelRatio: 0.005
      });
    }
    await expect(page.locator(".hemisphere--south .cloud-cover")).toHaveCSS("opacity", "0");
    await expect(page.locator(".hemisphere--south .rain")).toHaveCSS("opacity", "0");
    await expect(page.locator(".hemisphere--south .snow")).toHaveCSS("opacity", "0");
  });
}

test("night clouds dim the aurora and stars independently from precipitation", async ({ page }, testInfo) => {
  const current = { cloud_cover: 100, is_day: 0 };
  const scene = await showWeather(page, current);
  await expect(scene.locator(".daylight")).toHaveCSS("opacity", "0");
  await expect(scene.locator(".cloud-cover")).toHaveCSS("opacity", "0.48");
  await expect(scene.locator(".cloud-veil")).toHaveCSS("opacity", "0.69");
  await expect(scene.locator(".aurora-field")).toHaveCSS("opacity", "0.34");
  await expect(scene.locator(".stars")).toHaveCSS("filter", "opacity(0.28)");
  await expect(scene.locator(".rain")).toHaveCSS("opacity", "0");
  await expect(scene.locator(".snow")).toHaveCSS("opacity", "0");
  await recordRendering(scene, current, testInfo);
});

test("meeting city clouds hide stars without dimming city lights", async ({ page }, testInfo) => {
  const current = { cloud_cover: 100, is_day: 0 };
  const scene = await showWeather(page, current, { background: "meeting-city" });
  await expect(scene.locator(".stars")).toHaveCSS("filter", "opacity(0.28)");
  await expect(scene.locator(".city-lights")).toHaveCSS("filter", "opacity(1)");
  await recordRendering(scene, current, testInfo);
});

test("rain intensity has the documented light and heavy limits", async ({ page }, testInfo) => {
  const current = { cloud_cover: 40, weather_code: 61, rain: 0.05 };
  const scene = await showWeather(page, current);
  await expect(scene.locator(".rain")).toHaveCSS("opacity", "0.28");
  await expect(scene.locator(".rain")).toHaveCSS("filter", "blur(3.4px)");
  await expect(scene.locator(".rain")).toHaveCSS("animation-duration", "2.8s");
  await recordRendering(scene, current, testInfo);
  await page.route("https://api.open-meteo.com/**", (route) => route.fulfill({
    json: weatherResponse({ ...current, rain: 2 })
  }));
  await page.reload();
  await expect(scene.locator(".rain")).toHaveCSS("opacity", "0.88");
  await expect(scene.locator(".rain")).toHaveCSS("filter", "blur(0.15px)");
  await expect(scene.locator(".rain")).toHaveCSS("animation-duration", "1.6s");
  await recordRendering(scene, { ...current, rain: 2 }, testInfo);
});

test("a cached observation remains visible when the API is unavailable", async ({ page }, testInfo) => {
  const current = { cloud_cover: 40, rain: 0.75, snowfall: 0.5, weather_code: 95 };
  const scene = await showWeather(page, current);
  await expect(scene.locator(".rain")).toHaveCSS("opacity", "0.88");
  await page.route("https://api.open-meteo.com/**", (route) => route.fulfill({ status: 503 }));
  await page.reload();
  await expect(scene.locator(".cloud-cover")).toHaveCSS("opacity", "0.38");
  await expect(scene.locator(".rain")).toHaveCSS("opacity", "0.88");
  await expect(scene.locator(".snow")).toHaveCSS("opacity", "0.9");
  await expect(scene.locator(".thunder")).toHaveCSS("opacity", "0.55");
  await recordRendering(scene, current, testInfo);
});

test("disabled weather stays on a clear night even with a cached storm", async ({ page }, testInfo) => {
  const current = { cloud_cover: 100, rain: 0.75, snowfall: 0.5, weather_code: 95 };
  const scene = await showWeather(page, current);
  await expect(scene.locator(".rain")).toHaveCSS("opacity", "0.88");
  await page.route("**/config.json", async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.backgrounds = { ...config.backgrounds, fixed: "origin-weather", countdown: [], meetingDay: "", weather: false };
    await route.fulfill({ json: config });
  });
  await page.reload();
  await expect(scene).toHaveAttribute("data-phase", "night");
  for (const selector of [".daylight", ".cloud-cover", ".cloud-veil", ".rain", ".snow", ".thunder"]) {
    await expect(scene.locator(selector)).toHaveCSS("opacity", "0");
  }
  await expect(scene.locator(".stars")).toHaveCSS("filter", "opacity(1)");
  await recordRendering(scene, current, testInfo);
});

test("reduced motion leaves precipitation visible but stops movement and flashes", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const current = { cloud_cover: 100, rain: 0.75, snowfall: 0.5, weather_code: 99 };
  const scene = await showWeather(page, current);
  await expect(scene.locator(".rain")).toHaveCSS("opacity", "0.88");
  await expect(scene.locator(".snow")).toHaveCSS("opacity", "0.9");
  await expect(scene.locator(".rain")).toHaveCSS("animation-name", "none");
  await expect(scene.locator(".snow")).toHaveCSS("animation-name", "none");
  const painted = await recordRendering(scene, current, testInfo);
  expect(painted.lightning).toBe("none");
});

test("manual QA prints native API amounts next to normalized, computed rendering", async ({ page }, testInfo) => {
  const tables = [];
  page.on("console", async (message) => {
    if (message.type() === "table") {
      tables.push(await message.args()[0].jsonValue());
    }
  });
  const current = { cloud_cover: 40, rain: 0.75, snowfall: 0.5, weather_code: 95 };
  const scene = await showWeather(page, current);
  await expect.poll(() => tables.flat()).toContainEqual({
    variable: "rain (mm/h)", value: "3", painted: "opacity 0.88, rainfall"
  });
  expect(tables.flat()).toContainEqual({ variable: "rain", value: 0.75, unit: "mm" });
  expect(tables.flat()).toContainEqual({ variable: "interval", value: 900, unit: "seconds" });
  expect(tables.flat()).toContainEqual({
    variable: "snowfall (cm/h)", value: "2", painted: "opacity 0.9, snowfall"
  });
  await recordRendering(scene, current, testInfo);
});
