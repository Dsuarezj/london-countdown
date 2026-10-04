const CACHE_NAME = "trip-countdown-v11";
const NETWORK_PROBE_TIMEOUT_MS = 350;
const NETWORK_PROBE_TTL_MS = 5000;
let networkStatus;
let networkStatusCheckedAt = 0;
const APP_SHELL = [
  "./",
  "./index.html",
  "./config.json",
  "./translations/en.json",
  "./translations/es.json",
  "./translations/is.json",
  "./manifest.webmanifest",
  "./styles/base.css",
  "./styles/sky-layers.css",
  "./styles/meeting.css",
  "./styles/affection.css",
  "./styles/info-card.css",
  "./styles/install-prompt.css",
  "./styles/backgrounds/origin-weather.css",
  "./styles/backgrounds/converging.css",
  "./styles/backgrounds/meeting-city.css",
  "./characters/plover/plover.svg",
  "./characters/plover/plover.css",
  "./characters/hummingbird/hummingbird.svg",
  "./characters/hummingbird/hummingbird.css",
  "./src/main.js",
  "./src/services/cached-json.js",
  "./src/services/config.js",
  "./src/utils/enums.js",
  "./src/utils/stylesheet.js",
  "./src/utils/meeting-time.js",
  "./src/utils/thresholds.js",
  "./src/services/i18n.js",
  "./src/ui/headline.js",
  "./src/ui/countdown.js",
  "./src/services/connection.js",
  "./src/ui/origin-pins.js",
  "./src/ui/characters.js",
  "./src/ui/meeting.js",
  "./src/ui/info-card.js",
  "./src/ui/install-prompt.js",
  "./src/gateways/weather-gateway.js",
  "./src/backgrounds/index.js",
  "./src/backgrounds/aurora-tropics.js",
  "./src/backgrounds/origin-weather.js",
  "./src/backgrounds/converging.js",
  "./src/backgrounds/meeting-city.js",
  "./icons/icon.svg",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((path) => new Request(path, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

async function matchCached(cache, request) {
  const cachedResponse = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
  if (cachedResponse || request.mode !== "navigate") {
    return cachedResponse;
  }
  return cache.match("./index.html");
}

async function isNetworkAvailable() {
  if (!self.navigator.onLine) {
    networkStatus = false;
    return false;
  }

  if (Date.now() - networkStatusCheckedAt < NETWORK_PROBE_TTL_MS) {
    return networkStatus;
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), NETWORK_PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(`./manifest.webmanifest?ping=${Date.now()}`, {
      cache: "no-store",
      signal: abortController.signal
    });
    networkStatus = response.ok;
  } catch (networkError) {
    networkStatus = false;
  } finally {
    clearTimeout(timeoutId);
    networkStatusCheckedAt = Date.now();
  }

  return networkStatus;
}

async function networkFirst(request, event) {
  const cache = await caches.open(CACHE_NAME);
  if (!(await isNetworkAvailable())) {
    const cachedResponse = await matchCached(cache, request);
    if (cachedResponse) {
      return cachedResponse;
    }
  }

  try {
    const freshResponse = await fetch(request, { cache: "no-store" });
    if (freshResponse.ok) {
      event.waitUntil(cache.put(request, freshResponse.clone()));
    }
    return freshResponse;
  } catch (networkError) {
    const cachedResponse = await matchCached(cache, request);
    if (!cachedResponse) {
      throw networkError;
    }
    return cachedResponse;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.searchParams.has("ping")) {
    return;
  }
  event.respondWith(networkFirst(request, event));
});
