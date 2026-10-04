const JSON_CACHE_PREFIX = "trip-json:";

function jsonCacheKey(url) {
  return `${JSON_CACHE_PREFIX}${url}`;
}

export function readCachedJson(url) {
  const cachedJson = localStorage.getItem(jsonCacheKey(url));
  return cachedJson ? JSON.parse(cachedJson) : null;
}

export async function loadCachedJson(url) {
  try {
    const response = await fetch(url);
    const freshJson = await response.json();
    localStorage.setItem(jsonCacheKey(url), JSON.stringify(freshJson));
    return freshJson;
  } catch (networkError) {
    const cachedJson = readCachedJson(url);
    if (!cachedJson) {
      throw networkError;
    }
    return cachedJson;
  }
}
