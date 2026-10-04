import { readArticleSentences, refreshArticleSentences } from "@/gateways/wikipedia-gateway.js";
import { translateText } from "@/gateways/translation-gateway.js";

const ARTICLE_LANGUAGE = "en";

function topicFacts(topic, translator, dayNumber) {
  const localFacts = translator.translate(topic.facts);
  const fallbackText = localFacts[dayNumber % localFacts.length];
  return [
    ...localFacts.map((text) => ({ text, fromArticle: false, fallbackText })),
    ...readArticleSentences(topic.article).map((text) => ({ text, fromArticle: true, fallbackText }))
  ];
}

function interleave(factLists) {
  const deck = [];
  const longestLength = Math.max(...factLists.map((facts) => facts.length));
  for (let i = 0; i < longestLength; i += 1) {
    deck.push(...factLists.flatMap((facts) => facts[i] ?? []));
  }
  return deck;
}

export function refreshTopics(topics) {
  return Promise.allSettled(topics.map((topic) => refreshArticleSentences(topic.article)));
}

export async function pickDailyFact(topics, translator, dayNumber) {
  const deck = interleave(topics.map((topic) => topicFacts(topic, translator, dayNumber)));
  const fact = deck[dayNumber % deck.length];
  const language = translator.language();
  if (!fact.fromArticle || language === ARTICLE_LANGUAGE) {
    return fact;
  }
  try {
    return { ...fact, text: await translateText(fact.text, ARTICLE_LANGUAGE, language) };
  } catch {
    return { text: fact.fallbackText, fromArticle: false };
  }
}
