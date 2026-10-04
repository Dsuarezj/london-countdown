const TRANSLATE_URL = "https://api.mymemory.translated.net/get";
const TRANSLATION_CACHE_PREFIX = "translation:";
const REPEATED_WORDS = /\b(\S+)(?:\s+\1){2,}/i;

function translationCacheKey(text, targetLanguage) {
  return `${TRANSLATION_CACHE_PREFIX}${targetLanguage}:${text}`;
}

export async function translateText(text, sourceLanguage, targetLanguage) {
  const cacheKey = translationCacheKey(text, targetLanguage);
  const cachedTranslation = localStorage.getItem(cacheKey);
  if (cachedTranslation) {
    return cachedTranslation;
  }
  const response = await fetch(`${TRANSLATE_URL}?q=${encodeURIComponent(text)}&langpair=${sourceLanguage}|${targetLanguage}`);
  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}`);
  }
  const { responseStatus, responseData } = await response.json();
  if (Number(responseStatus) !== 200) {
    throw new Error(`Translation rejected with status ${responseStatus}`);
  }
  if (REPEATED_WORDS.test(responseData.translatedText)) {
    throw new Error("Translation degenerated into repeated words");
  }
  localStorage.setItem(cacheKey, responseData.translatedText);
  return responseData.translatedText;
}
