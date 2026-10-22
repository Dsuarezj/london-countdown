import { expect, test } from "@playwright/test";

async function showAurora(page, background) {
  await page.clock.setFixedTime(new Date("2026-10-01T23:00:00Z"));
  await page.addInitScript(() => localStorage.setItem("install-prompt", JSON.stringify({ installed: true })));
  await page.route("**/config.json", async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.meeting.date = "2026-11-13";
    config.meeting.end = { date: "2026-11-15", time: "10:00" };
    config.backgrounds = { ...config.backgrounds, fixed: background, mode: "fixed", countdown: [], meetingDay: "", weather: false };
    await route.fulfill({ json: config });
  });
  await page.route("https://api.open-meteo.com/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("#sky")).toHaveClass(`sky sky--${background}`);
}

for (const background of ["aurora-tropics", "origin-weather", "converging"]) {
  test(`${background} uses feathered veils with independent animated folds`, async ({ page }) => {
    await showAurora(page, background);
    const auroras = page.locator(".aurora");
    await expect(auroras).toHaveCount(background === "origin-weather" ? 6 : 3);
    await expect(auroras.first()).toHaveCSS("filter", "blur(7px)");
    await expect(auroras.first()).toHaveCSS("animation-name", "aurora-drift");
    await expect(auroras.first().locator(".aurora__folds")).toHaveCSS("animation-name", "aurora-fold");
    await expect(auroras.first().locator("feTurbulence")).toHaveAttribute("baseFrequency", ".045 .003");
    const references = await auroras.evaluateAll((elements) => elements.flatMap((element) =>
      [...element.querySelectorAll("[fill], [stroke], [filter]")].flatMap((node) =>
        ["fill", "stroke", "filter"].map((attribute) => node.getAttribute(attribute))
          .filter((value) => value?.startsWith("url(")).map((value) => {
          const id = value.match(/^url\(#(.+)\)$/)?.[1];
          return Boolean(id && element.querySelector(`[id="${id}"]`));
        })
      )
    ));
    expect(references.every(Boolean)).toBe(true);
    const ids = await page.locator(".aurora [id]").evaluateAll((elements) => elements.map((element) => element.id));
    expect(new Set(ids).size).toBe(ids.length);
    const bounds = await auroras.first().boundingBox();
    const { width } = page.viewportSize();
    expect(bounds.x).toBeLessThan(-width * .15);
    expect(bounds.width).toBeGreaterThan(width * 1.3);
    expect(bounds.x + bounds.width).toBeGreaterThan(width);
    if (background === "origin-weather") {
      await expect(page.locator(".hemisphere--north .aurora-field")).toHaveCSS("opacity", "0.92");
      await expect(page.locator(".hemisphere--south .aurora-field")).toHaveCSS("opacity", "0");
    }
  });
}

test("Nordic and French nights have distinct dark palettes and star fields", async ({ page }) => {
  await showAurora(page, "origin-weather");
  const north = page.locator(".hemisphere--north");
  const france = page.locator(".hemisphere--south");
  await expect(north).toHaveAttribute("data-phase", "night");
  await expect(france).toHaveAttribute("data-phase", "night");
  const skies = await page.locator(".hemisphere").evaluateAll((elements) => elements.map((element) => ({
    background: getComputedStyle(element).backgroundImage,
    starTile: getComputedStyle(element.querySelector(".stars"), "::before").backgroundImage,
    starOffset: getComputedStyle(element.querySelector(".stars"), "::before").backgroundPosition
  })));
  expect(skies[0].background).not.toBe(skies[1].background);
  expect(skies[1].background).toContain("rgb(17, 25, 42)");
  expect(skies.every((sky) => sky.starTile.includes("radial-gradient"))).toBe(true);
  expect(skies[0].starOffset).not.toBe(skies[1].starOffset);
});

test("France has a denser star field and recognizable star-only autumn constellations", async ({ page }) => {
  await showAurora(page, "origin-weather");
  await expect(page.locator(".hemisphere--north .constellation")).toHaveCount(0);
  for (const name of ["cassiopeia", "cygnus"]) {
    const constellation = page.locator(`.hemisphere--south .constellation--${name}`);
    await expect(constellation.locator("circle[data-star]")).toHaveCount(5);
    await expect(constellation.locator("line, path, polyline, text")).toHaveCount(0);
    await expect(constellation).toHaveAttribute("aria-hidden", "true");
    await expect(constellation).toHaveCSS("transform", "matrix(1, 0, 0, -1, 0, 0)");
  }
  const densities = await page.locator(".hemisphere .stars").evaluateAll((elements) => elements.map((element) =>
    ["::before", "::after"].reduce((density, pseudo) => {
      const style = getComputedStyle(element, pseudo);
      const count = (style.backgroundImage.match(/radial-gradient/g) ?? []).length;
      const [width, height] = style.backgroundSize.split(" ").map(Number.parseFloat);
      return density + count / (width * height);
    }, 0)
  ));
  expect(densities[1]).toBeGreaterThan(densities[0] * 2.5);
});

for (const viewport of [{ width: 320, height: 360 }, { width: 667, height: 375 }]) {
  test(`reduced motion keeps a static, diffuse aurora at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await showAurora(page, "origin-weather");
    await expect(page.locator(".aurora").first()).toHaveCSS("animation-name", "none");
    await expect(page.locator(".aurora__folds").first()).toHaveCSS("animation-name", "none");
    await expect(page.locator(".aurora").first()).toHaveCSS("filter", "blur(7px)");
    for (const constellation of await page.locator(".constellation").all()) {
      const bounds = await constellation.boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(110);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  });
}

test.describe("mobile aurora", () => {
  test.use({ isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  async function freezeSky(page) {
    await page.evaluate(() => document.getAnimations().forEach((animation) => {
      animation.pause();
      animation.currentTime = 6000;
    }));
  }

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 }
  ]) {
    test(`keeps broad visible folds at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize(viewport);
      await showAurora(page, "origin-weather");
      const curtain = page.locator(".hemisphere--north .aurora--one .aurora__curtain");
      await expect(curtain.locator(".aurora__folds")).toHaveCSS("animation-name", "aurora-fold");
      await freezeSky(page);
      const portrait = viewport.height > viewport.width;
      await expect(curtain).toHaveCSS("transform", portrait ? "matrix(2.6, 0, 0, 1, 0, 0)" : "none");
      const fold = await curtain.locator(".aurora__folds > path").nth(2).boundingBox();
      if (portrait) {
        expect(fold.width / fold.height).toBeGreaterThan(.45);
        expect(fold.width).toBeGreaterThan(viewport.width * .5);
        const visibleWidth = Math.min(fold.x + fold.width, viewport.width) - Math.max(fold.x, 0);
        expect(visibleWidth).toBeGreaterThan(viewport.width * .3);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      await expect(page.locator(".hemisphere--south .aurora-field")).toHaveCSS("opacity", "0");
      expect(errors).toEqual([]);
      await page.addStyleTag({ content: ".stage, .route, .pins, .topbar, .install-prompt { visibility: hidden !important; }" });
      await testInfo.attach("Clear mobile sky", {
        body: await page.screenshot({ path: testInfo.outputPath("clear-mobile-sky.png"), scale: "css" }),
        contentType: "image/png"
      });
    });
  }

  for (const background of ["aurora-tropics", "converging"]) {
    test(`widens the shared curtains in ${background}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await showAurora(page, background);
      for (const curtain of await page.locator(".aurora__curtain").all()) {
        await expect(curtain).toHaveCSS("transform", "matrix(2.6, 0, 0, 1, 0, 0)");
      }
    });
  }

  test("responds to rotation without changing the desktop geometry", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await showAurora(page, "origin-weather");
    const curtain = page.locator(".hemisphere--north .aurora--one .aurora__curtain");
    await expect(curtain).toHaveCSS("transform", "matrix(2.6, 0, 0, 1, 0, 0)");
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(curtain).toHaveCSS("transform", "none");
    await page.setViewportSize({ width: 320, height: 360 });
    await expect(curtain).toHaveCSS("transform", "matrix(1.5, 0, 0, 1, 0, 0)");
    await page.setViewportSize({ width: 960, height: 720 });
    await expect(curtain).toHaveCSS("transform", "none");
    await expect(curtain.locator(".aurora__folds")).toHaveCSS("animation-name", "aurora-fold");
  });

  test("retains broad folds with reduced motion", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await showAurora(page, "origin-weather");
    const aurora = page.locator(".hemisphere--north .aurora--one");
    await expect(aurora).toHaveCSS("animation-name", "none");
    await expect(aurora.locator(".aurora__folds")).toHaveCSS("animation-name", "none");
    await expect(aurora.locator(".aurora__curtain")).toHaveCSS("transform", "matrix(2.6, 0, 0, 1, 0, 0)");
    const fold = await aurora.locator(".aurora__folds > path").nth(2).boundingBox();
    expect(fold.width / fold.height).toBeGreaterThan(.45);
  });
});
