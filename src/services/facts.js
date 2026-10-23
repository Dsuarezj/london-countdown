import { createFactTopics, validateFactCatalog } from "@/utils/fact-catalog.js";

const HISTORY_KEY = "trip-facts:v1";

function readHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY));
    if (history === null) {
      return { topics: {}, slots: {} };
    }
    if (!history || typeof history.topics !== "object" || !history.topics
      || typeof history.slots !== "object" || !history.slots) {
      throw new Error("Invalid curiosity history");
    }
    return history;
  } catch (error) {
    console.warn("Could not read curiosity history; starting a new rotation", error);
    return { topics: {}, slots: {} };
  }
}

export async function createFactDeck(config, translator) {
  const topicsBySlot = createFactTopics(config, translator.translate);
  const response = await fetch("facts.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load curiosity catalog (${response.status})`);
  }
  const catalog = await response.json();
  validateFactCatalog(catalog, topicsBySlot, config.languages);

  const stored = readHistory();
  const history = { topics: {}, slots: {} };
  for (const [slot, topics] of Object.entries(topicsBySlot)) {
    history.slots[slot] = Number.isInteger(stored.slots[slot]) && stored.slots[slot] >= 0
      ? stored.slots[slot] % topics.length : 0;
    for (const topic of topics) {
      const identity = JSON.stringify(topic);
      const ids = new Set(catalog.topics[topic.key].facts.map((fact) => fact.id));
      const previous = stored.topics[identity];
      history.topics[identity] = {
        seen: Array.isArray(previous?.seen) ? previous.seen.filter((id) => ids.has(id)) : [],
        last: ids.has(previous?.last) ? previous.last : null
      };
    }
  }

  function next(slot) {
    const topics = topicsBySlot[slot];
    const index = history.slots[slot];
    const topic = topics[index];
    const facts = catalog.topics[topic.key].facts;
    const progress = history.topics[JSON.stringify(topic)];
    let fact = facts.find(({ id }) => !progress.seen.includes(id));
    if (!fact) {
      progress.seen = [];
      fact = facts.find(({ id }) => id !== progress.last) ?? facts[0];
    }
    progress.seen.push(fact.id);
    progress.last = fact.id;
    history.slots[slot] = (index + 1) % topics.length;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.warn("Could not save curiosity history; rotation will last only for this visit", error);
    }
    return { ...fact, topic };
  }

  return { next };
}
