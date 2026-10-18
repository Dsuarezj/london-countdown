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
  const removalTimeout = setTimeout(() => rainElement.remove(), 8500);
  return () => {
    clearTimeout(removalTimeout);
    rainElement.remove();
  };
}

const TOGETHER_ANIMATIONS = {
  "heart-rain": {
    stylesheet: "styles/together/heart-rain.css",
    play: playHeartRain
  }
};

export function createTogetherPlayer(togetherId) {
  let arrived = false;
  let hasPlayed = false;
  let stopped = false;
  let stopAnimation;
  const togetherAnimation = TOGETHER_ANIMATIONS[togetherId];
  const stylesReady = togetherAnimation ? loadStylesheet(togetherAnimation.stylesheet) : Promise.resolve();

  async function playWhenReady(remainingMs) {
    if (hasPlayed || !arrived || remainingMs > 0 || !togetherAnimation) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hasPlayed = true;
      return;
    }
    hasPlayed = true;
    await stylesReady;
    if (!stopped) {
      stopAnimation = togetherAnimation.play(document.body);
    }
  }

  return {
    markArrived() {
      arrived = true;
    },
    playWhenReady,
    stop() {
      stopped = true;
      hasPlayed = true;
      stopAnimation?.();
    }
  };
}
