import { requestTopicArticle } from "@/gateways/wikipedia-gateway.js";

const CACHE_PREFIX = "topic-article:v1:";
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const pendingArticles = new Map();

export function createFactTopics(origin, character, translator, fallbackLanguage) {
  const language = translator.language();
  const placeTopic = (key, kind) => ({
    kind,
    source: { language, title: translator.translate(key), country: translator.translate(origin.label) },
    fallback: {
      language: fallbackLanguage,
      title: translator.translate(key, fallbackLanguage),
      country: translator.translate(origin.label, fallbackLanguage)
    },
    ...(kind === "city" ? { latitude: origin.latitude, longitude: origin.longitude } : {})
  });
  return [
    {
      kind: "species",
      source: { language, title: character.scientificName },
      fallback: { language: fallbackLanguage, title: character.scientificName }
    },
    placeTopic(origin.city, "city"),
    placeTopic(origin.label, "country")
  ];
}

function readArticle(key) {
  try {
    const article = JSON.parse(localStorage.getItem(key));
    if (!article) {
      return null;
    }
    if (!Number.isFinite(article.fetchedAt) || !Array.isArray(article.passages) || !article.passages.length
      || !["title", "url", "language"].every((key) => typeof article[key] === "string")
      || !article.passages.every((passage) => typeof passage?.text === "string" && typeof passage.section === "string")) {
      throw new Error("Invalid saved topic article");
    }
    return article;
  } catch (error) {
    console.warn("Could not read saved topic article", error);
    return null;
  }
}

async function loadArticle(topic, key, storedArticle) {
  let article;
  try {
    article = await requestTopicArticle(topic);
  } catch (error) {
    if (!storedArticle) {
      throw error;
    }
    console.warn("Could not refresh topic article; using its saved copy", error);
    return { ...storedArticle, stale: true };
  }
  const freshArticle = { ...article, fetchedAt: Date.now() };
  try {
    localStorage.setItem(key, JSON.stringify(freshArticle));
  } catch (error) {
    console.warn("Could not save topic article for offline use", error);
  }
  return freshArticle;
}

async function topicArticle(topic) {
  const key = `${CACHE_PREFIX}${JSON.stringify(topic)}`;
  const storedArticle = readArticle(key);
  if (storedArticle && Date.now() - storedArticle.fetchedAt < REFRESH_INTERVAL_MS) {
    return storedArticle;
  }
  if (!pendingArticles.has(key)) {
    const pending = loadArticle(topic, key, storedArticle).finally(() => pendingArticles.delete(key));
    pendingArticles.set(key, pending);
  }
  return pendingArticles.get(key);
}

export async function pickFact(topics, selectionIndex) {
  const topic = topics[selectionIndex % topics.length];
  const article = await topicArticle(topic);
  const passage = article.passages[Math.floor(selectionIndex / topics.length) % article.passages.length];
  const anchor = passage.section ? `#${encodeURIComponent(passage.section.replaceAll(" ", "_"))}` : "";
  return {
    text: passage.text,
    title: article.title,
    section: passage.section,
    language: article.language,
    sourceUrl: `${article.url}${anchor}`,
    stale: article.stale ?? false
  };
}
