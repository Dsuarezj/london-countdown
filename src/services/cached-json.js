const JSON_CACHE_PREFIX = "loa-json:";

export async function loadCachedJson(url) {
  const cacheKey = `${JSON_CACHE_PREFIX}${url}`;
  try {
    const response = await fetch(url);
    const freshJson = await response.json();
    localStorage.setItem(cacheKey, JSON.stringify(freshJson));
    return freshJson;
  } catch (networkError) {
    const cachedJson = localStorage.getItem(cacheKey);
    if (!cachedJson) {
      throw networkError;
    }
    return JSON.parse(cachedJson);
  }
}
