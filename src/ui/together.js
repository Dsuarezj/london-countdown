import { loadStylesheet } from "@/utils/stylesheet.js";

const HEART_RAIN_COUNT = 10;

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

export function createTogetherPlayer(togetherId) {
  let hasArrived = false;
  let hasPlayed = false;
  const togetherAnimation = TOGETHER_ANIMATIONS[togetherId];

  async function playIfReady(remainingMs) {
    if (hasPlayed || !hasArrived || remainingMs > 0 || !togetherAnimation) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hasPlayed = true;
      return;
    }
    hasPlayed = true;
    await loadStylesheet(togetherAnimation.stylesheet);
    togetherAnimation.play(document.body);
  }

  return {
    markArrived() {
      hasArrived = true;
    },
    playIfReady
  };
}
