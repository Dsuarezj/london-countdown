const API_URL = "https://en.wikipedia.org/w/api.php";
const ARCHIVE_PREFIX = "Wikipedia:Did you know archive/";
const REQUEST_TIMEOUT_MS = 8000;
const MAX_CITY_DISTANCE_KM = 75;

async function wikipedia(parameters) {
  const query = new URLSearchParams({
    format: "json", formatversion: "2", origin: "*", ...parameters
  });
  const response = await fetch(`${API_URL}?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`Wikipedia request failed with status ${response.status}`);
  }
  const result = await response.json();
  if (result.error) {
    throw new Error(`Wikipedia rejected the request: ${result.error.code}`);
  }
  if (parameters.action === "query"
    && !Array.isArray(parameters.list === "search" ? result.query?.search : result.query?.pages)) {
    throw new Error("Wikipedia returned an invalid query response");
  }
  return result;
}

function cityDistance(topic, coordinate) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const lat1 = radians(topic.latitude);
  const lat2 = radians(coordinate.lat);
  const haversine = Math.sin((lat2 - lat1) / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(radians(coordinate.lon - topic.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function matchesTopic(page, topic) {
  if (!page || typeof page.title !== "string" || page.missing || page.invalid
    || Object.hasOwn(page.pageprops ?? {}, "disambiguation")) {
    return false;
  }
  return topic.kind !== "city"
    || page.coordinates?.some((coordinate) => cityDistance(topic, coordinate) <= MAX_CITY_DISTANCE_KM);
}

async function resolveTopic(topic) {
  const parameters = {
    action: "query", prop: "info|pageprops|coordinates", titles: topic.title,
    redirects: "1", inprop: "url", coprimary: "primary"
  };
  const direct = await wikipedia(parameters);
  const page = direct.query?.pages?.[0];
  if (matchesTopic(page, topic)) {
    return page;
  }
  if (topic.kind !== "city") {
    return null;
  }
  const search = await wikipedia({
    action: "query", list: "search", srsearch: `${topic.title} ${topic.country}`, srlimit: "5"
  });
  const titles = search.query?.search?.map(({ title }) => title);
  if (!titles?.length) {
    return null;
  }
  const candidates = await wikipedia({ ...parameters, titles: titles.join("|") });
  const normalize = (title) => title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const cityName = normalize(topic.title);
  return candidates.query?.pages?.find((candidate) => {
    const title = normalize(candidate.title);
    return (title === cityName || title.startsWith(`${cityName} (`) || title.startsWith(`${cityName},`))
      && matchesTopic(candidate, topic);
  }) ?? null;
}

function linkedTitle(anchor) {
  const url = new URL(anchor.getAttribute("href"), "https://en.wikipedia.org");
  if (url.origin !== "https://en.wikipedia.org") {
    return null;
  }
  const title = url.pathname.startsWith("/wiki/")
    ? decodeURIComponent(url.pathname.slice(6))
    : url.searchParams.get("title");
  return title?.replaceAll("_", " ");
}

export function archiveFacts(html, topicTitle, archive) {
  const document = new DOMParser().parseFromString(html, "text/html");
  return Array.from(document.querySelectorAll("li")).flatMap((item) => {
    if (item.querySelector("li")
      || !Array.from(item.querySelectorAll("a[href]")).some((anchor) => linkedTitle(anchor) === topicTitle)) {
      return [];
    }
    const text = item.textContent.replace(/\s+/g, " ").trim();
    if (!/^(?:\.{3}|…)\s*that\b/i.test(text) || !text.endsWith("?")) {
      return [];
    }
    // Keep the entire published hook, including any parenthetical context.
    return [{
      id: text,
      text,
      title: topicTitle,
      language: "en",
      sourceUrl: `https://en.wikipedia.org/w/index.php?oldid=${archive.revid}`,
      sourceName: "Wikipedia · Did you know?"
    }];
  });
}

export async function requestTopicFacts(topic, round) {
  const page = await resolveTopic(topic);
  if (!page) {
    return [];
  }
  const search = async (offset) => wikipedia({
    action: "query", list: "search", srnamespace: "4",
    srsearch: `linksto:"${page.title.replaceAll('"', "")}" prefix:"${ARCHIVE_PREFIX}"`,
    srlimit: "2", sroffset: String(offset), srprop: ""
  });
  const offset = (round * 2) % 500;
  let results = await search(offset);
  if (!results.query?.search?.length && offset > 0) {
    results = await search(0);
  }
  const facts = [];
  for (const result of results.query?.search ?? []) {
    if (!result.title.startsWith(ARCHIVE_PREFIX)) {
      continue;
    }
    const archive = await wikipedia({
      action: "parse", pageid: String(result.pageid), prop: "text|revid", disableeditsection: "1"
    });
    if (typeof archive.parse?.text !== "string" || !Number.isInteger(archive.parse.revid)) {
      throw new Error("Wikipedia returned an invalid curiosity archive");
    }
    facts.push(...archiveFacts(archive.parse.text, page.title, archive.parse));
  }
  return facts.filter((fact, index) => facts.findIndex(({ id }) => id === fact.id) === index);
}
