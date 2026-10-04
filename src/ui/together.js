import { loadStylesheet } from "@/utils/stylesheet.js";

const HEART_RAIN_COUNT = 10;
const OPENING_DELAY_MS = 1000;

function playHeartRain(hostElement) {
  const rainElement = document.createElement("div");
  rainElement.className = "together together--heart-rain";
  rainElement.setAttribute("aria-hidden", "true");
  for (let i = 0; i < HEART_RAIN_COUNT; i++) {
    const heartElement = document.createElement("span");
    heartElement.className = "together__heart";
    heartElement.textContent = "♥";
    rainElement.append(heartElement);
  }
  hostElement.append(rainElement);
  setTimeout(() => rainElement.remove(), 8500);
}

const TOGETHER_ANIMATIONS = {
  "heart-rain": {
    stylesheet: "styles/together/heart-rain.css",
    play: playHeartRain
  }
};

function wait(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function readBeatDurationMs() {
  const durationSeconds = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--beat-duration")
  );
  return Number.isFinite(durationSeconds) ? durationSeconds * 1000 : 2600;
}

export function createTogetherPlayer(togetherId) {
  let arrivedAtMs = 0;
  let hasPlayed = false;
  const togetherAnimation = TOGETHER_ANIMATIONS[togetherId];

  async function playWhenReady(remainingMs) {
    if (hasPlayed || !arrivedAtMs || remainingMs > 0 || !togetherAnimation) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hasPlayed = true;
      return;
    }
    hasPlayed = true;
    const openingMs = OPENING_DELAY_MS + readBeatDurationMs();
    const remainingOpeningMs = openingMs - (Date.now() - arrivedAtMs);
    if (remainingOpeningMs > 0) {
      await wait(remainingOpeningMs);
    }
    await loadStylesheet(togetherAnimation.stylesheet);
    togetherAnimation.play(document.body);
  }

  return {
    markArrived() {
      arrivedAtMs = Date.now();
    },
    playWhenReady
  };
}
