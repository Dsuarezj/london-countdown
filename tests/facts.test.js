import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { archiveFacts, requestTopicFacts } from "../src/gateways/wikipedia-gateway.js";
import { createFactTopics, pickFact } from "../src/services/facts.js";

const config = JSON.parse(await readFile(new URL("../config.json", import.meta.url)));
const dictionary = JSON.parse(await readFile(new URL("../translations/en.json", import.meta.url)));
const translator = {
  translate: (key, language) => {
    assert.equal(language, "en");
    return key.split(".").reduce((node, part) => node[part], dictionary);
  }
};
const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalParser = globalThis.DOMParser;
const originalWarn = console.warn;
let stored;
let requests;
let warnings;
let hooks;
let searchResults;
const firstText = "... that Iceland's volcanic landscape contains a hotspot as well as a boundary between tectonic plates?";
const secondText = "... that a second published curiosity about Iceland can be read in its original archive?";
const topic = { kind: "country", title: "Iceland" };
const hook = (text, title = "Iceland") => ({
  textContent: text,
  querySelector: () => null,
  querySelectorAll: () => [{ getAttribute: () => `/wiki/${title.replaceAll(" ", "_")}` }]
});
const json = (data) => ({ ok: true, json: async () => data });

beforeEach(() => {
  stored = new Map();
  requests = [];
  warnings = [];
  hooks = [hook(firstText), hook(secondText)];
  searchResults = [{ title: "Wikipedia:Did you know archive/2020/May", pageid: 123 }];
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) }
  });
  // The browser suite exercises real HTML parsing; these tests supply a document tree.
  globalThis.DOMParser = class {
    parseFromString() {
      return { querySelectorAll: () => hooks };
    }
  };
  globalThis.fetch = async (url, options) => {
    const request = new URL(url);
    requests.push({ url: request, options });
    const parameters = request.searchParams;
    if (parameters.get("action") === "parse") {
      return json({ parse: { text: "<ul>published hooks</ul>", revid: 456 } });
    }
    if (parameters.get("list") === "search") {
      return json({ query: { search: searchResults } });
    }
    return json({ query: { pages: [{
      title: parameters.get("titles"),
      coordinates: [{ lat: config.origins.north.latitude, lon: config.origins.north.longitude }]
    }] } });
  };
  console.warn = (...args) => warnings.push(args);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.DOMParser = originalParser;
  console.warn = originalWarn;
  if (originalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalStorage);
  } else {
    delete globalThis.localStorage;
  }
});

test("topic identities follow configured labels and scientific name, independent of the UI language", () => {
  const origin = config.origins.north;
  const topics = createFactTopics(origin, config.characters.plover, translator);
  assert.deepEqual(topics, [
    { kind: "species", title: "Pluvialis apricaria" },
    { kind: "city", title: "Reykjavík", country: "Iceland", latitude: 64.1466, longitude: -21.9426 },
    { kind: "country", title: "Iceland" }
  ]);
  const moved = createFactTopics({
    ...origin, city: "places.ceret", label: "places.france", latitude: 42.4853, longitude: 2.7486
  }, config.characters.hummingbird, translator);
  assert.equal(moved[0].title, "Colibri coruscans");
  assert.equal(moved[1].title, "Céret");
  assert.equal(moved[2].title, "France");
});

test("only whole published hooks linked to the exact topic are accepted", () => {
  hooks.push(hook("An arbitrary article paragraph about Iceland."));
  hooks.push(hook("... that a published curiosity about Ireland belongs elsewhere?", "Ireland"));
  hooks.push(hook("... that an incomplete hook has no ending"));
  hooks.push({ ...hook(firstText), querySelector: () => ({}) });
  const facts = archiveFacts("", "Iceland", { revid: 456 });
  assert.deepEqual(facts.map(({ text }) => text), [firstText, secondText]);
  assert.ok(facts.every(({ language, sourceUrl }) =>
    language === "en" && sourceUrl === "https://en.wikipedia.org/w/index.php?oldid=456"));
});

test("the source searches DYK archives rather than article extracts and bypasses HTTP cache", async () => {
  const facts = await requestTopicFacts(topic, 0);
  assert.equal(facts.length, 2);
  const search = requests.find(({ url }) => url.searchParams.get("list") === "search");
  assert.equal(search.url.searchParams.get("srsearch"),
    'linksto:"Iceland" prefix:"Wikipedia:Did you know archive/"');
  assert.equal(search.url.searchParams.get("sroffset"), "0");
  assert.ok(requests.every(({ url, options }) =>
    options.cache === "no-store" && !url.searchParams.has("explaintext")));
});

test("each opening makes a fresh source request and skips already seen hooks", async () => {
  const first = await pickFact([topic], 0);
  const firstRequests = requests.length;
  const second = await pickFact([topic], 1, new Set([first.id]));
  assert.equal(first.text, firstText);
  assert.equal(second.text, secondText);
  assert.equal(requests.length, firstRequests * 2);
  assert.equal(second.stale, false);
  assert.equal(stored.size, 1);
});

test("new source content replaces previously saved content while online", async () => {
  await pickFact([topic], 0);
  const newText = "... that newly published content from Iceland can arrive after the first opening?";
  hooks = [hook(newText)];
  assert.equal((await pickFact([topic], 1)).text, newText);
});

test("a topic with no published curiosities tries the next configured topic", async () => {
  const beforeFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (new URL(url).searchParams.get("srsearch")?.includes('"Céret"')) {
      return json({ query: { search: [] } });
    }
    return beforeFetch(url, options);
  };
  const fact = await pickFact([{ kind: "country", title: "Céret" }, topic], 0);
  assert.equal(fact.title, "Iceland");
  assert.equal(fact.text, firstText);
});

test("no matches report NO_FACTS without substituting paragraphs or cached unrelated content", async () => {
  await pickFact([topic], 0);
  searchResults = [];
  await assert.rejects(pickFact([{ kind: "country", title: "France" }], 0), { code: "NO_FACTS" });
  await assert.rejects(pickFact([topic], 0), { code: "NO_FACTS" });
});

test("offline uses a matching saved curiosity only and labels it stale", async () => {
  const first = await pickFact([topic], 0);
  globalThis.fetch = async () => { throw new Error("offline"); };
  const second = await pickFact([topic], 1, new Set([first.id]));
  assert.equal(second.text, secondText);
  assert.equal(second.stale, true);
  assert.equal(warnings.length, 1);
  await assert.rejects(pickFact([{ kind: "country", title: "France" }], 0), { code: "SOURCE_UNAVAILABLE" });
});

test("exhausted search results are explicitly marked instead of claiming to be new", async () => {
  const result = await pickFact([topic], 2, new Set([firstText, secondText]));
  assert.equal(result.exhausted, true);
});

test("search offsets move through archives and restart when a topic has fewer results", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (new URL(url).searchParams.get("sroffset") === "4") {
      requests.push({ url: new URL(url), options });
      return json({ query: { search: [] } });
    }
    return original(url, options);
  };
  assert.equal((await requestTopicFacts(topic, 2)).length, 2);
  assert.deepEqual(requests.filter(({ url }) => url.searchParams.has("sroffset"))
    .map(({ url }) => url.searchParams.get("sroffset")), ["4", "0"]);
});

test("invalid saved JSON is logged instead of being presented as a curiosity", async () => {
  stored.set(`published-facts:v1:${JSON.stringify(topic)}`, "{broken");
  globalThis.fetch = async () => { throw new Error("offline"); };
  await assert.rejects(pickFact([topic], 0), { code: "SOURCE_UNAVAILABLE" });
  assert.equal(warnings.length, 2);
});

test("a storage write failure does not discard a freshly fetched curiosity", async () => {
  localStorage.setItem = () => { throw new Error("storage full"); };
  assert.equal((await pickFact([topic], 0)).text, firstText);
  assert.equal(warnings.length, 1);
});

test("API failures are reported and do not save success-shaped defaults", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 429 });
  await assert.rejects(requestTopicFacts(topic, 0), /429/);
  assert.equal(stored.size, 0);
  globalThis.fetch = async () => json({ error: { code: "maxlag" } });
  await assert.rejects(requestTopicFacts(topic, 0), /maxlag/);
  globalThis.fetch = async () => json({ query: {} });
  await assert.rejects(requestTopicFacts(topic, 0), /invalid query response/);
});

test("disambiguation pages and wrong-city coordinates are rejected", async () => {
  globalThis.fetch = async () => json({ query: { pages: [{ title: "Iceland", pageprops: { disambiguation: "" } }], search: [] } });
  assert.deepEqual(await requestTopicFacts(topic, 0), []);
  globalThis.fetch = async () => json({ query: { pages: [{
    title: "Reykjavík", coordinates: [{ lat: 0, lon: 0 }]
  }], search: [] } });
  assert.deepEqual(await requestTopicFacts({
    kind: "city", title: "Reykjavík", country: "Iceland", latitude: 64.1466, longitude: -21.9426
  }, 0), []);
});
