import { expect, test } from "@playwright/test";

const titles = { "Pluvialis apricaria": "European golden plover", "Colibri coruscans": "Sparkling violetear" };
const archiveTitle = "Wikipedia:Did you know archive/2020/May";
const hooks = (title, edition = "first") => `<ul>
  <li>... that <b><a href="/wiki/${title.replaceAll(" ", "_")}">${title}</a></b> has a ${edition} published curiosity with its own complete context?</li>
  <li>... that a second complete curiosity about <a href="/wiki/${title.replaceAll(" ", "_")}">${title}</a> is also available?</li>
  <li>Not a curiosity: a paragraph mentioning <a href="/wiki/${title.replaceAll(" ", "_")}">${title}</a>.</li>
  <li>... that <a href="/wiki/Unrelated">another topic</a> should not be selected?</li>
</ul>`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("trip-language", "es");
    localStorage.setItem("install-prompt", JSON.stringify({ installed: true }));
  });
  await page.route("**/*", (route) => new URL(route.request().url()).origin === "http://127.0.0.1:4173"
    ? route.fallback()
    : route.abort());
});

async function source(page, { empty = [], edition = () => "first" } = {}) {
  const requests = [];
  const archiveTopics = new Map();
  await page.route("https://en.wikipedia.org/w/api.php?**", async (route) => {
    const parameters = new URL(route.request().url()).searchParams;
    requests.push(parameters);
    if (parameters.get("action") === "parse") {
      const title = archiveTopics.get(parameters.get("pageid"));
      return route.fulfill({ json: { parse: { text: hooks(title, edition()), revid: 456 } } });
    }
    if (parameters.get("list") === "search") {
      const title = parameters.get("srsearch").match(/^linksto:"([^"]+)"/)?.[1];
      const id = String([...title].reduce((sum, char) => sum + char.codePointAt(0), 0));
      archiveTopics.set(id, title);
      return route.fulfill({ json: { query: {
        search: empty.includes(title) ? [] : [{ title: archiveTitle, pageid: Number(id) }]
      } } });
    }
    const requestedTitle = parameters.get("titles");
    const title = titles[requestedTitle] ?? requestedTitle;
    return route.fulfill({ json: { query: { pages: [{
      title, coordinates: title === "Céret"
        ? [{ lat: 42.4853, lon: 2.7486 }]
        : [{ lat: 64.1466, lon: -21.9426 }]
    }] } } });
  });
  return requests;
}

async function open(page, slot = "north") {
  const dialog = page.locator("#infoCard");
  if (await dialog.isVisible()) {
    await page.locator(".info-card__close").click();
  }
  await page.locator(`.pin--${slot}`).click();
  return page.locator("#infoCardFact");
}

test("clicks query published curiosities again, rotate topics and skip repeats", async ({ page }) => {
  const requests = await source(page);
  await page.goto("/");
  const seen = [];
  for (const title of ["European golden plover", "Reykjavík", "Iceland", "European golden plover"]) {
    const fact = await open(page);
    await expect(page.locator("#infoCardFactContext")).toHaveText(`${title} · Wikipedia · Did you know?`);
    await expect(fact).toContainText(title);
    await expect(fact).toHaveText(/^\.\.\. that .+\?$/);
    seen.push(await fact.textContent());
  }
  expect(new Set(seen).size).toBe(4);
  expect(requests.filter((query) => query.get("action") === "parse")).toHaveLength(4);
  expect(requests.every((query) => !query.has("explaintext"))).toBe(true);
  await expect(page.locator("#infoCardFactNotice")).toContainText("inglés");
  await expect(page.locator("#infoCardFact")).toHaveAttribute("lang", "en");
  await expect(page.locator("#infoCardFactSource")).toHaveAttribute("href", "https://en.wikipedia.org/w/index.php?oldid=456");
  await expect(page.locator('#infoCardFactAttribution a[rel*="license"]')).toBeVisible();
});

test("language rerenders preserve the current curiosity without fetching again", async ({ page }) => {
  const requests = await source(page);
  await page.goto("/");
  const fact = await open(page);
  await expect(fact).toContainText("European golden plover");
  const text = await fact.textContent();
  const count = requests.length;
  await page.evaluate(() => document.getElementById("languageButton").click());
  await expect(page.locator("html")).toHaveAttribute("lang", "is");
  await expect(fact).toHaveText(text);
  expect(requests.length).toBe(count);
  await expect(page.locator("#infoCardFactNotice")).toContainText("Heimildin");
});

test("a source update is used instead of a saved batch", async ({ page }) => {
  let edition = "first";
  await source(page, { edition: () => edition });
  await page.goto("/");
  await expect(await open(page)).toContainText("first published");
  edition = "newly updated";
  await open(page);
  await expect(await open(page)).toContainText("Iceland");
  await expect(await open(page)).toContainText("newly updated published");
});

test("missing city or species coverage falls through to the configured country", async ({ page }) => {
  const requests = await source(page, { empty: ["European golden plover", "Reykjavík"] });
  await page.goto("/");
  await expect(await open(page)).toContainText("Iceland");
  const searches = requests.filter((query) => query.has("srsearch"));
  expect(searches.map((query) => query.get("srsearch"))).toEqual([
    'linksto:"European golden plover" prefix:"Wikipedia:Did you know archive/"',
    'linksto:"Reykjavík" prefix:"Wikipedia:Did you know archive/"',
    'linksto:"Iceland" prefix:"Wikipedia:Did you know archive/"'
  ]);
});

test("a changed city uses its own source search, not old saved location facts", async ({ page }) => {
  await source(page, { empty: ["European golden plover"] });
  await page.route("**/config.json", async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.origins.north = {
      ...config.origins.north, city: "places.ceret", label: "places.france",
      latitude: 42.4853, longitude: 2.7486, timeZone: "Europe/Paris"
    };
    await route.fulfill({ json: config });
  });
  await page.goto("/");
  await expect(await open(page)).toContainText("Céret");
  await expect(page.locator("#infoCardArrival")).toHaveText("Ubicación actual: Céret, Francia");
  await expect(page.locator("#infoCardFactContext")).not.toContainText("Reykjavík");
});

test("offline fallback is explicit, and an unseen topic never borrows another topic's saved facts", async ({ page }) => {
  const requests = await source(page);
  await page.goto("/");
  await expect(await open(page)).toContainText("European golden plover");
  const count = requests.length;
  await page.unroute("https://en.wikipedia.org/w/api.php?**");
  await page.route("https://en.wikipedia.org/w/api.php?**", (route) => route.abort());
  await expect(await open(page)).toContainText("European golden plover");
  await expect(page.locator("#infoCardFactNotice")).toContainText("se muestra una curiosidad guardada");
  expect(requests.length).toBe(count);
  await expect(await open(page, "south")).toContainText("No se pudo cargar contenido");
  await expect(page.locator("#infoCardFactAttribution")).toBeHidden();
});

test("empty results show a clear state, never an extracted paragraph", async ({ page }) => {
  await source(page, { empty: ["European golden plover", "Reykjavík", "Iceland"] });
  await page.goto("/");
  await expect(await open(page)).toContainText("No se encontraron curiosidades publicadas");
  await expect(page.locator("#infoCardFactAttribution")).toBeHidden();
  await expect(page.locator("#infoCardFactContext")).toBeHidden();
});

test("older requests cannot replace the curiosity from the most recently opened pin", async ({ page }) => {
  await source(page);
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let started;
  const pending = new Promise((resolve) => { started = resolve; });
  await page.route("https://en.wikipedia.org/w/api.php?**", async (route) => {
    const query = new URL(route.request().url()).searchParams;
    if (query.get("titles") === "Pluvialis apricaria") {
      started();
      await held;
    }
    await route.fallback();
  });
  await page.goto("/");
  await open(page);
  await pending;
  await expect(await open(page, "south")).toContainText("Sparkling violetear");
  release();
  await expect(page.locator("#infoCardFactContext")).toHaveText("Sparkling violetear · Wikipedia · Did you know?");
  await expect(page.locator("#infoCardName")).toContainText("Quinde");
  await expect.poll(async () => page.evaluate(() => Object.keys(localStorage)
    .some((key) => key.includes("published-facts:") && key.includes("Pluvialis")))).toBe(true);
  await expect(page.locator("#infoCardFact")).toContainText("Sparkling violetear");
});

test("repetition is labelled once the bounded search has no unseen curiosities", async ({ page }) => {
  await source(page, { empty: ["European golden plover", "Reykjavík"] });
  await page.goto("/");
  await expect(await open(page)).toContainText("first published");
  await expect(await open(page)).toContainText("second complete");
  await expect(await open(page)).toContainText("Iceland");
  await expect(page.locator("#infoCardFactNotice")).toContainText("Ya has visto las curiosidades");
});

test("actual HTML parsing preserves complete hooks and rejects unrelated links, nested lists and markup injection", async ({ page }) => {
  await page.goto("/");
  const facts = await page.evaluate(async () => {
    const { archiveFacts } = await import("/src/gateways/wikipedia-gateway.js");
    return archiveFacts(`<ul>
      <li>...that the <b><a href="/wiki/Iceland_hotspot">Iceland hotspot</a></b> helps explain volcanic activity in <a href="/wiki/Iceland">Iceland</a>?</li>
      <li>... that <a href="/wiki/Iceland">Iceland</a> has an intact hook (pictured)?</li>
      <li>... that <a href="https://example.com/wiki/Iceland">a misleading link</a> is not a match?</li>
      <li>A generic paragraph about <a href="/wiki/Iceland">Iceland</a>.</li>
      <li><a href="/wiki/Iceland">Iceland</a><ul><li>Nested navigation</li></ul></li>
    </ul>`, "Iceland", { revid: 987 });
  });
  expect(facts.map(({ text }) => text)).toEqual([
    "...that the Iceland hotspot helps explain volcanic activity in Iceland?",
    "... that Iceland has an intact hook (pictured)?"
  ]);
  expect(facts.every(({ sourceUrl }) => sourceUrl.endsWith("oldid=987"))).toBe(true);
});
