const MAX_PASSAGE_LENGTH = 800;
const MIN_PASSAGE_LENGTH = 100;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_CITY_DISTANCE_KM = 75;
const INTERESTING_SECTION = /et[yi]molog|topon[ií]m|cultur|menning|nafngift|örnefni|behavio[u]?r|comportamiento|hegðun|ecolog|vistfr|folklore|þjóðtrú|tradition|tradici|hefð|cuisine|gastronom/iu;
const EXCLUDED_SECTION = /^(?:see also|notes|references|bibliography|further reading|external links|véase también|notas|referencias|bibliografía|enlaces externos|sjá einnig|heimildir|tilvísanir|tenglar)(?:\s|$)/iu;
const CONTEXTLESS_OPENING = /^(?:it|its|they|their|this|these|those|he|she|his|her|however|also|su|sus|esto|esta|estos|estas|ellos|ellas|sin embargo|además|þetta|þessi|þessir|þessar|hann|hún|þeir|þær|það)\b/iu;

export function articlePassages(extract) {
  const passages = [];
  const headings = [];
  let previousParagraph = "";
  for (const block of extract.split(/\n+/).map((line) => line.trim()).filter(Boolean)) {
    const heading = block.match(/^(={2,6})\s*(.*?)\s*\1$/);
    if (heading) {
      const level = heading[1].length;
      while (headings.at(-1)?.level >= level) {
        headings.pop();
      }
      headings.push({ level, title: heading[2] });
      previousParagraph = "";
      continue;
    }
    const paragraph = block.replace(/[\u200b\u200e\u200f]/g, "");
    const text = CONTEXTLESS_OPENING.test(paragraph) && previousParagraph
      ? `${previousParagraph}\n\n${paragraph}`
      : paragraph;
    const hasContext = !CONTEXTLESS_OPENING.test(text);
    previousParagraph = paragraph;
    if (headings.some(({ title }) => EXCLUDED_SECTION.test(title))
      || !hasContext || text.length < MIN_PASSAGE_LENGTH || text.length > MAX_PASSAGE_LENGTH
      || !/[.!?…][”»")]*$/u.test(text) || /^(?:[*•]|\d+[.)]\s)/u.test(text)
      || /\b(?:ISBN|ISSN)\b/.test(text)) {
      continue;
    }
    passages.push({
      text,
      section: headings.at(-1)?.title ?? "",
      interesting: headings.some(({ title }) => INTERESTING_SECTION.test(title))
    });
  }
  const preferred = passages.filter(({ interesting }) => interesting);
  const selected = preferred.length ? preferred : passages;
  return selected
    .filter((passage, index) => selected.findIndex(({ text }) => text === passage.text) === index)
    .map(({ text, section }) => ({ text, section }));
}

async function wikipedia(language, parameters) {
  if (!/^[a-z]{2,3}(?:-[a-z]+)?$/.test(language)) {
    throw new Error(`Unsupported Wikipedia language: ${language}`);
  }
  const query = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", origin: "*", ...parameters
  });
  const response = await fetch(`https://${language}.wikipedia.org/w/api.php?${query}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`Wikipedia request failed with status ${response.status}`);
  }
  const result = await response.json();
  if (result.error) {
    throw new Error(`Wikipedia rejected the request: ${result.error.code}`);
  }
  return result.query;
}

function cityDistance(topic, coordinate) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const lat1 = radians(topic.latitude);
  const lat2 = radians(coordinate.lat);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(coordinate.lon - topic.longitude);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function matchesTopic(page, topic) {
  if (!page || page.missing || page.invalid || !page.extract
    || Object.hasOwn(page.pageprops ?? {}, "disambiguation")) {
    return false;
  }
  return topic.kind !== "city"
    || page.coordinates?.some((coordinate) => cityDistance(topic, coordinate) <= MAX_CITY_DISTANCE_KM);
}

async function findPage(topic, source, targetLanguage) {
  const parameters = {
    prop: "extracts|info|pageprops|coordinates|langlinks",
    titles: source.title, redirects: "1", explaintext: "1", inprop: "url",
    coprimary: "primary", lllang: targetLanguage
  };
  const direct = await wikipedia(source.language, parameters);
  const page = direct?.pages?.[0];
  if (matchesTopic(page, topic)) {
    return page;
  }
  if (topic.kind !== "city") {
    return null;
  }
  const search = await wikipedia(source.language, {
    list: "search", srsearch: `${source.title} ${source.country}`, srlimit: "5"
  });
  const titles = search?.search?.map(({ title }) => title);
  if (!titles?.length) {
    return null;
  }
  const candidates = await wikipedia(source.language, { ...parameters, titles: titles.join("|") });
  const normalize = (title) => title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const cityName = normalize(source.title);
  return candidates?.pages?.find((candidate) => {
    const title = normalize(candidate.title);
    return (title === cityName || title.startsWith(`${cityName} (`) || title.startsWith(`${cityName},`))
      && matchesTopic(candidate, topic);
  }) ?? null;
}

function topicArticle(page, language) {
  const passages = articlePassages(page.extract);
  if (!passages.length) {
    return null;
  }
  return { title: page.title, url: page.fullurl, language, passages };
}

export async function requestTopicArticle(topic) {
  const { source, fallback } = topic;
  const page = await findPage(topic, source, source.language);
  const article = page && topicArticle(page, source.language);
  if (article) {
    return article;
  }
  if (fallback.language !== source.language) {
    const fallbackPage = await findPage(topic, fallback, source.language);
    if (fallbackPage) {
      const linkedTitle = fallbackPage.langlinks?.find(({ lang }) => lang === source.language)?.title;
      if (linkedTitle && linkedTitle !== page?.title) {
        const linkedPage = await findPage(topic, { ...source, title: linkedTitle }, source.language);
        const linkedArticle = linkedPage && topicArticle(linkedPage, source.language);
        if (linkedArticle) {
          return linkedArticle;
        }
      }
      const fallbackArticle = topicArticle(fallbackPage, fallback.language);
      if (fallbackArticle) {
        return fallbackArticle;
      }
    }
  }
  throw new Error(`No contextual Wikipedia content for ${source.language}:${source.title}`);
}
