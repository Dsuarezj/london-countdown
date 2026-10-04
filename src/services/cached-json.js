const JSON_CACHE_PREFIX = "loa-json:";

async function fetchAndStoreJson(url, cacheKey) {
  const response = await fetch(url);
  const freshJson = await response.json();
  localStorage.setItem(cacheKey, JSON.stringify(freshJson));
  return freshJson;
}

export async function loadCachedJson(url) {
  const cacheKey = `${JSON_CACHE_PREFIX}${url}`;
  const freshJson = fetchAndStoreJson(url, cacheKey);
  const cachedJson = localStorage.getItem(cacheKey);
  if (!cachedJson) {
    return freshJson;
  }
  freshJson.catch(() => {});
  return JSON.parse(cachedJson);
}
