import { requestTopicFacts } from "@/gateways/wikipedia-gateway.js";

const CACHE_PREFIX = "published-facts:v1:";
const SAVED_FACT_LIMIT = 20;

export function createFactTopics(origin, character, translator) {
  return [
    { kind: "species", title: character.scientificName },
    {
      kind: "city", title: translator.translate(origin.city, "en"),
      country: translator.translate(origin.label, "en"),
      latitude: origin.latitude, longitude: origin.longitude
    },
    { kind: "country", title: translator.translate(origin.label, "en") }
  ];
}

function readFacts(topic) {
  try {
    const saved = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${JSON.stringify(topic)}`));
    if (!saved) {
      return [];
    }
    if (!Array.isArray(saved) || !saved.every((fact) =>
      ["id", "text", "title", "sourceUrl", "sourceName"].every((key) => typeof fact[key] === "string")
      && fact.language === "en"
      && /^https:\/\/en\.wikipedia\.org\/w\/index\.php\?oldid=\d+$/.test(fact.sourceUrl))) {
      throw new Error("Invalid saved curiosities");
    }
    return saved;
  } catch (error) {
    console.warn("Could not read saved curiosities", error);
    return [];
  }
}

function saveFacts(topic, facts) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${JSON.stringify(topic)}`, JSON.stringify(facts.slice(-SAVED_FACT_LIMIT)));
  } catch (error) {
    console.warn("Could not save curiosities for offline use", error);
  }
}

export async function pickFact(topics, selectionIndex, seen = new Set()) {
  const round = Math.floor(selectionIndex / topics.length);
  let repeatedFact;
  let failed = false;
  for (let attempt = 0; attempt < topics.length; attempt += 1) {
    const topic = topics[(selectionIndex + attempt) % topics.length];
    let facts;
    let stale = false;
    try {
      facts = await requestTopicFacts(topic, round);
      if (facts.length) {
        saveFacts(topic, facts);
      }
    } catch (error) {
      console.warn("Could not fetch published curiosities", error);
      facts = readFacts(topic);
      stale = true;
      failed = true;
    }
    const candidates = facts.map((fact) => ({ ...fact, stale }));
    const unseen = candidates.find(({ id }) => !seen.has(id));
    if (unseen) {
      return unseen;
    }
    if (candidates.length) {
      repeatedFact ??= candidates[round % candidates.length];
    }
  }
  if (repeatedFact) {
    return { ...repeatedFact, exhausted: true };
  }
  const error = new Error(failed ? "Curiosity sources are unavailable" : "No published curiosities found for these topics");
  error.code = failed ? "SOURCE_UNAVAILABLE" : "NO_FACTS";
  throw error;
}
