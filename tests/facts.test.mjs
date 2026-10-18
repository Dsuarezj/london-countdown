import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { afterEach, beforeEach, test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith("@/")
      ? new URL(`../src/${specifier.slice(2)}`, import.meta.url).href
      : specifier, context);
  }
});
const { createFactTopics, pickFact } = await import("../src/services/facts.js");
const { articlePassages, requestTopicArticle } = await import("../src/gateways/wikipedia-gateway.js");
const { createTranslator } = await import("../src/services/i18n.js");
const config = JSON.parse(await readFile(new URL("../config.json", import.meta.url)));
const dictionaries = Object.fromEntries(await Promise.all(config.languages.map(async (language) => [
  language, JSON.parse(await readFile(new URL(`../translations/${language}.json`, import.meta.url)))
])));
const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalWarn = console.warn;
let stored;
let calls;
let warnings;
let cardInstance = 0;

const paragraph = "The city's old river crossing once held a world record for its stone arch. Local builders completed the bridge in the fourteenth century without a support in the middle of the river.";
const secondParagraph = "The city's annual harvest has a ceremonial role as well as a culinary one. A box of the first fruit is traditionally sent to the head of state each spring.";
const page = (title, overrides = {}) => ({
  title, extract: `== Culture ==\n${paragraph}\n\n${secondParagraph}`,
  fullurl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`,
  ...overrides
});
const response = (query) => ({ ok: true, json: async () => ({ query }) });
const sourceTopic = (title, overrides = {}) => ({
  kind: "country", source: { language: "en", title }, fallback: { language: "en", title }, ...overrides
});
const dictionaryTranslator = (language, values = dictionaries) => ({
  language: () => language,
  translate: (key, selectedLanguage = language) =>
    key.split(".").reduce((value, part) => value[part], values[selectedLanguage])
});

beforeEach(() => {
  stored = new Map();
  calls = [];
  warnings = [];
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value)
    }
  });
  globalThis.fetch = async (url) => {
    calls.push(new URL(url));
    return response({ pages: [page(new URL(url).searchParams.get("titles"))] });
  };
  console.warn = (...values) => warnings.push(values);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  if (originalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalStorage);
  } else {
    delete globalThis.localStorage;
  }
});

test("topics derive from the configured species and place, not fact lists or old topics", () => {
  const origin = config.origins.north;
  const character = config.characters[origin.character];
  for (const language of config.languages) {
    const translator = dictionaryTranslator(language);
    const topics = createFactTopics(origin, character, translator, config.languages[0]);
    assert.deepEqual(topics.map(({ kind }) => kind), ["species", "city", "country"]);
    assert.equal(topics[0].source.title, character.scientificName);
    assert.equal(topics[1].source.title, translator.translate(origin.city));
    assert.equal(topics[2].source.title, translator.translate(origin.label));
    assert.equal(topics[1].fallback.title, dictionaries.en.places.reykjavik);
    assert.equal(topics[1].latitude, origin.latitude);
    assert.equal(topics[1].longitude, origin.longitude);
    assert.equal(dictionaries[language].facts, undefined);
  }
});

test("translate can look up the fallback name without switching active language", async () => {
  stored.set("trip-language", "es");
  globalThis.fetch = async (url) => ({
    json: async () => dictionaries[String(url).match(/translations\/(.+)\.json/)[1]]
  });
  const translator = await createTranslator(config.languages);
  assert.equal(translator.translate("places.france"), "Francia");
  assert.equal(translator.translate("places.france", "en"), "France");
  assert.equal(translator.language(), "es");
});

test("passages preserve full paragraphs, their headings and supporting context", () => {
  const dependent = "Its builders also used local stone for the parapets, leaving a crossing that is still a recognisable landmark in the town.";
  const extract = `A short introduction.\n== Culture ==\n${paragraph}\n${dependent}\n=== Festival ===\n${secondParagraph}\n== References ==\n${paragraph}\n== External links ==\n${secondParagraph}`;
  assert.deepEqual(articlePassages(extract), [
    { text: paragraph, section: "Culture" },
    { text: `${paragraph}\n\n${dependent}`, section: "Culture" },
    { text: secondParagraph, section: "Festival" }
  ]);
});

test("extraction skips orphan pronouns, lists, incomplete and oversized paragraphs without truncation", () => {
  const oversized = `${paragraph} `.repeat(6).trim();
  const extract = `== Culture ==\nIts old name is sometimes used in regional maps, but this sentence has no preceding paragraph to explain what it means.\n== Other ==\n${oversized}\n* ${paragraph}\n${paragraph.slice(0, -1)}\n${secondParagraph}`;
  assert.deepEqual(articlePassages(extract), [{ text: secondParagraph, section: "Other" }]);
});

test("thematic passages are preferred to generic article introductions", () => {
  assert.deepEqual(articlePassages(`${paragraph}\n== Etimología ==\n${secondParagraph}`), [
    { text: secondParagraph, section: "Etimología" }
  ]);
});

test("successive selections rotate species, city and country and link to the original section", async () => {
  const topics = ["Species", "City", "Country"].map((title) => sourceTopic(title));
  for (let selection = 0; selection < 6; selection += 1) {
    const fact = await pickFact(topics, selection);
    assert.equal(fact.title, topics[selection % 3].source.title);
    assert.equal(fact.text, selection < 3 ? paragraph : secondParagraph);
    assert.equal(fact.sourceUrl, `https://en.wikipedia.org/wiki/${fact.title}#Culture`);
    assert.equal(fact.language, "en");
    assert.equal(fact.stale, false);
    assert.deepEqual(await pickFact(topics, selection), fact);
  }
  assert.equal(calls.length, 3);
});

test("changing city and country loads new articles even when old topics and caches exist", async () => {
  const origin = config.origins.north;
  const character = config.characters[origin.character];
  const translator = dictionaryTranslator("en");
  globalThis.fetch = async (url) => {
    const request = new URL(url);
    calls.push(request);
    const title = request.searchParams.get("titles");
    const coordinates = title === "Céret"
      ? [{ lat: 42.4853, lon: 2.7486 }]
      : [{ lat: origin.latitude, lon: origin.longitude }];
    return response({ pages: [page(title, { coordinates })] });
  };
  const before = createFactTopics(origin, character, translator, "en");
  assert.equal((await pickFact(before, 1)).title, "Reykjavík");
  assert.equal((await pickFact(before, 2)).title, "Iceland");
  const moved = {
    ...origin,
    city: "places.ceret", label: "places.france", latitude: 42.4853, longitude: 2.7486,
    topics: [{ article: "Reykjavík", facts: "facts.reykjavik" }]
  };
  const after = createFactTopics(moved, character, translator, "en");
  assert.equal((await pickFact(after, 1)).title, "Céret");
  assert.equal((await pickFact(after, 2)).title, "France");
  assert.equal(calls.length, 4);
  assert.equal(stored.size, 4);
});

test("editing the values behind existing place keys also changes the cache identity", async () => {
  const translator = dictionaryTranslator("en", structuredClone(dictionaries));
  const origin = config.origins.north;
  const character = config.characters[origin.character];
  const oldTopics = createFactTopics(origin, character, translator, "en");
  const changedDictionaries = structuredClone(dictionaries);
  changedDictionaries.en.places.iceland = "Denmark";
  const newTopics = createFactTopics(origin, character, dictionaryTranslator("en", changedDictionaries), "en");
  assert.equal((await pickFact(oldTopics, 2)).title, "Iceland");
  assert.equal((await pickFact(newTopics, 2)).title, "Denmark");
  assert.equal(calls.length, 2);
});

test("city disambiguation uses coordinates and does not choose nearby attractions", async () => {
  const topic = sourceTopic("Cambridge", {
    kind: "city", latitude: 42.3736, longitude: -71.1097,
    source: { language: "en", title: "Cambridge", country: "United States" }
  });
  globalThis.fetch = async (url) => {
    const request = new URL(url);
    calls.push(request);
    if (request.searchParams.has("list")) {
      return response({ search: [{ title: "Harvard University" }, { title: "Cambridge, Massachusetts" }] });
    }
    if (request.searchParams.get("titles").includes("|")) {
      return response({ pages: [
        page("Harvard University", { coordinates: [{ lat: 42.3736, lon: -71.1097 }] }),
        page("Cambridge, Massachusetts", { coordinates: [{ lat: 42.3736, lon: -71.1097 }] })
      ] });
    }
    return response({ pages: [page("Cambridge", { coordinates: [{ lat: 52.2053, lon: 0.1218 }] })] });
  };
  assert.equal((await requestTopicArticle(topic)).title, "Cambridge, Massachusetts");
  assert.equal(calls[1].searchParams.get("srsearch"), "Cambridge United States");
});

test("unresolved city and disambiguation pages never become successful facts", async () => {
  globalThis.fetch = async () => response({ pages: [page("Ambiguous", { pageprops: { disambiguation: "" } })], search: [] });
  await assert.rejects(requestTopicArticle(sourceTopic("Ambiguous")), /No contextual Wikipedia content/);
  await assert.rejects(requestTopicArticle(sourceTopic("Unknown", {
    kind: "city", latitude: 0, longitude: 0
  })), /No contextual Wikipedia content/);
});

test("missing localized scientific-name redirects can resolve via a fallback language link", async () => {
  const topic = sourceTopic("Colibri coruscans", {
    kind: "species",
    source: { language: "es", title: "Colibri coruscans" }
  });
  globalThis.fetch = async (url) => {
    const request = new URL(url);
    calls.push(request);
    if (request.hostname === "en.wikipedia.org") {
      return response({ pages: [page("Sparkling violetear", { langlinks: [{ lang: "es", title: "Colibrí rutilante" }] })] });
    }
    const title = request.searchParams.get("titles");
    return response({ pages: [title === "Colibrí rutilante"
      ? page(title, { fullurl: "https://es.wikipedia.org/wiki/Colibrí_rutilante" })
      : { title, missing: true }] });
  };
  const fact = await pickFact([topic], 0);
  assert.equal(fact.language, "es");
  assert.equal(fact.title, "Colibrí rutilante");
  assert.equal(calls.length, 3);
});

test("fallback content retains its real language and never becomes a fake translation", async () => {
  globalThis.fetch = async (url) => response({
    pages: [new URL(url).hostname === "is.wikipedia.org"
      ? { missing: true }
      : page("Sparkling violetear")]
  });
  const fact = await pickFact([sourceTopic("Colibri coruscans", {
    kind: "species", source: { language: "is", title: "Colibri coruscans" }
  })], 0);
  assert.equal(fact.language, "en");
  assert.equal(fact.text, paragraph);
});

test("cache is separated by language and simultaneous requests share one fetch", async () => {
  const topic = sourceTopic("France");
  const [first, second] = await Promise.all([pickFact([topic], 0), pickFact([topic], 0)]);
  assert.deepEqual(first, second);
  assert.equal(calls.length, 1);
  await pickFact([sourceTopic("France", {
    source: { language: "es", title: "Francia" }, fallback: { language: "en", title: "France" }
  })], 0);
  assert.equal(calls.length, 2);
  assert.equal(stored.size, 2);
});

test("offline refresh uses only a matching saved topic and reports stale content", async () => {
  const topic = sourceTopic("Iceland");
  const first = await pickFact([topic], 0);
  for (const [key, json] of stored) {
    stored.set(key, JSON.stringify({ ...JSON.parse(json), fetchedAt: 0 }));
  }
  globalThis.fetch = async () => { throw new Error("offline"); };
  const saved = await pickFact([topic], 0);
  assert.equal(saved.text, first.text);
  assert.equal(saved.stale, true);
  assert.equal(warnings.length, 1);
  await assert.rejects(pickFact([sourceTopic("New country")], 0), /offline/);
});

test("failed API requests are retried instead of caching unrelated fallback content", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  const topic = sourceTopic("France");
  await assert.rejects(pickFact([topic], 0), /503/);
  assert.equal(stored.size, 0);
  globalThis.fetch = async () => response({ pages: [page("France")] });
  assert.equal((await pickFact([topic], 0)).title, "France");
});

test("invalid cached JSON is reported and replaced with a fresh article", async () => {
  const topic = sourceTopic("Iceland");
  await pickFact([topic], 0);
  for (const key of stored.keys()) {
    stored.set(key, "{invalid json");
  }
  assert.equal((await pickFact([topic], 0)).title, "Iceland");
  assert.equal(warnings.length, 1);
  assert.equal(calls.length, 2);
});

test("saving failures do not discard successfully fetched content", async () => {
  globalThis.localStorage.setItem = () => { throw new Error("storage full"); };
  assert.equal((await pickFact([sourceTopic("France")], 0)).title, "France");
  assert.equal(warnings.length, 1);
});

async function withInfoCard(run) {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          textContent: "", hidden: true, dataset: {}, addEventListener() {},
          showModal() { this.open = true; }
        });
      }
      return elements.get(id);
    }
  };
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  try {
    const { createInfoCard } = await import(`../src/ui/info-card.js?test=${cardInstance++}`);
    await run(createInfoCard, (id) => document.getElementById(id));
  } finally {
    if (originalDocument) {
      Object.defineProperty(globalThis, "document", originalDocument);
    } else {
      delete globalThis.document;
    }
  }
}

const flush = () => new Promise(setImmediate);

test("the card exposes loading/errors and hides stale context, source and license together", async () => {
  globalThis.fetch = async () => { throw new Error("offline"); };
  await withInfoCard(async (createInfoCard, element) => {
    const translator = dictionaryTranslator("es");
    const card = createInfoCard(config, translator);
    card.open("north");
    assert.equal(element("infoCardFact").textContent, dictionaries.es.ui.factLoading);
    assert.equal(element("infoCardFactAttribution").hidden, true);
    assert.equal(element("infoCardFactContext").hidden, true);
    await flush();
    assert.equal(element("infoCardFact").textContent, dictionaries.es.ui.factUnavailable);
    assert.equal(element("infoCardFact").lang, "es");
    assert.equal(element("infoCardFactAttribution").hidden, true);
    assert.equal(warnings.length, 1);
  });
});

test("a late response cannot overwrite a newer pin's content or attribution", async () => {
  const pending = [];
  globalThis.fetch = (url) => new Promise((resolve) => pending.push({ url: new URL(url), resolve }));
  await withInfoCard(async (createInfoCard, element) => {
    const card = createInfoCard(config, dictionaryTranslator("en"));
    card.open("north");
    card.open("south");
    assert.equal(pending.length, 2);
    pending[1].resolve(response({ pages: [page("Sparkling violetear")] }));
    await flush();
    const expectedSource = element("infoCardFactSource").href;
    assert.equal(element("infoCardFactContext").textContent, "Sparkling violetear · Culture");
    assert.equal(element("infoCardFactAttribution").hidden, false);
    pending[0].resolve(response({ pages: [page("European golden plover")] }));
    await flush();
    assert.equal(element("infoCardFactContext").textContent, "Sparkling violetear · Culture");
    assert.equal(element("infoCardFactSource").href, expectedSource);
  });
});

test("fallback-language text is visibly labelled in the card", async () => {
  globalThis.fetch = async (url) => response({
    pages: [new URL(url).hostname === "es.wikipedia.org"
      ? { missing: true }
      : page("European golden plover")]
  });
  await withInfoCard(async (createInfoCard, element) => {
    createInfoCard(config, dictionaryTranslator("es")).open("north");
    await flush();
    assert.equal(element("infoCardFact").lang, "en");
    assert.equal(element("infoCardFactContext").lang, "en");
    assert.equal(element("infoCardFactNotice").hidden, false);
    assert.match(element("infoCardFactNotice").textContent, /inglés/);
    assert.equal(element("infoCardFactAttribution").hidden, false);
  });
});

test("each pin opening advances, other pins keep their position, and language rerenders do not advance", async () => {
  globalThis.fetch = async (url) => {
    const request = new URL(url);
    calls.push(request);
    const title = request.searchParams.get("titles");
    return response({ pages: [page(title, {
      coordinates: [{ lat: config.origins.north.latitude, lon: config.origins.north.longitude }],
      extract: `== Culture ==\n${title}: ${paragraph}\n\n${title}: ${secondParagraph}`
    })] });
  };
  let language = "en";
  const translator = {
    language: () => language,
    translate: (key, selectedLanguage = language) => dictionaryTranslator(selectedLanguage).translate(key)
  };
  await withInfoCard(async (createInfoCard, element) => {
    const card = createInfoCard(config, translator);
    const seen = [];
    const expected = [
      ["Pluvialis apricaria", paragraph],
      ["Reykjavík", paragraph],
      ["Iceland", paragraph],
      ["Pluvialis apricaria", secondParagraph]
    ];
    for (const [title, passage] of expected) {
      card.open("north");
      await flush();
      const text = element("infoCardFact").textContent;
      assert.equal(text, `${title}: ${passage}`);
      seen.push(text);
      card.render();
      await flush();
      assert.equal(element("infoCardFact").textContent, text);
    }
    assert.equal(new Set(seen).size, 4);
    card.open("south");
    await flush();
    assert.equal(element("infoCardFact").textContent, `Colibri coruscans: ${paragraph}`);
    card.open("north");
    await flush();
    assert.equal(element("infoCardFact").textContent, `Reykjavík: ${secondParagraph}`);
    language = "es";
    card.render();
    await flush();
    assert.equal(element("infoCardFact").textContent, `Reikiavik: ${secondParagraph}`);
    assert.equal(element("infoCardFactContext").textContent, "Reikiavik · Culture");
    assert.equal(warnings.length, 0);
  });
});
