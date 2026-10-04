const CACHE_NAME = "london-countdown-v11";
const NETWORK_TIMEOUT_MS = 1000;
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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

function rejectAfter(timeoutMs) {
  return new Promise((resolve, reject) => setTimeout(() => reject(new Error("Network timeout")), timeoutMs));
}

async function matchCached(cache, request) {
  const cachedResponse = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
  if (cachedResponse || request.mode !== "navigate") {
    return cachedResponse;
  }
  return cache.match("./index.html");
}

async function networkFirst(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const freshResponse = fetch(request, { cache: "no-store" }).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });
  event.waitUntil(freshResponse.catch(() => {}));

  try {
    return await Promise.race([freshResponse, rejectAfter(NETWORK_TIMEOUT_MS)]);
  } catch (networkError) {
    return (await matchCached(cache, request)) ?? freshResponse;
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
