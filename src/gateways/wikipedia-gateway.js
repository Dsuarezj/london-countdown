const ARTICLE_API_URL = "https://en.wikipedia.org/w/api.php";
const SENTENCE_CACHE_PREFIX = "article-sentences:";
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const SENTENCES_PER_ARTICLE = 8;
const MIN_SENTENCE_LENGTH = 60;
const MAX_SENTENCE_LENGTH = 220;
const CONTEXTLESS_OPENING = /^(It|Its|They|Their|This|These|Those|He|She|His|Her|However|Also|In addition|Both)\b/;
const MARKUP_CHARACTERS = /[()[\]=]/;
const APPENDIX_HEADING = /\n==\s*(See also|Notes|References|Further reading|External links)\s*==/;

function sentenceCacheKey(article) {
  return `${SENTENCE_CACHE_PREFIX}${article}`;
}

function readStoredArticle(article) {
  const storedArticle = localStorage.getItem(sentenceCacheKey(article));
  return storedArticle ? JSON.parse(storedArticle) : null;
}

function subjectKeyword(article) {
  return article.split(" ").at(-1).toLowerCase();
}

function isReadableSentence(sentence, keyword) {
  return sentence.length >= MIN_SENTENCE_LENGTH
    && sentence.length <= MAX_SENTENCE_LENGTH
    && sentence.toLowerCase().includes(keyword)
    && !CONTEXTLESS_OPENING.test(sentence)
    && !MARKUP_CHARACTERS.test(sentence);
}

function splitSentences(articleText, keyword) {
  const sentenceSegmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  return articleText
    .split(APPENDIX_HEADING)[0]
    .split("\n")
    .filter((line) => line && !line.startsWith("="))
    .flatMap((paragraph) => Array.from(sentenceSegmenter.segment(paragraph), ({ segment }) => segment.trim()))
    .filter((sentence) => isReadableSentence(sentence, keyword));
}

function spreadSelection(sentences, count) {
  if (sentences.length <= count) {
    return sentences;
  }
  const step = sentences.length / count;
  const selectedSentences = [];
  for (let i = 0; i < count; i += 1) {
    selectedSentences.push(sentences[Math.floor(i * step)]);
  }
  return selectedSentences;
}

async function requestArticleSentences(article) {
  const response = await fetch(`${ARTICLE_API_URL}?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&origin=*&titles=${encodeURIComponent(article)}`);
  if (!response.ok) {
    throw new Error(`Wikipedia request failed with status ${response.status}`);
  }
  const { query } = await response.json();
  return spreadSelection(splitSentences(query.pages[0].extract ?? "", subjectKeyword(article)), SENTENCES_PER_ARTICLE);
}

export function readArticleSentences(article) {
  return readStoredArticle(article)?.sentences ?? [];
}

export async function refreshArticleSentences(article) {
  const storedArticle = readStoredArticle(article);
  if (storedArticle && Date.now() - storedArticle.fetchedAt < REFRESH_INTERVAL_MS) {
    return;
  }
  const sentences = await requestArticleSentences(article);
  localStorage.setItem(sentenceCacheKey(article), JSON.stringify({ fetchedAt: Date.now(), sentences }));
}
