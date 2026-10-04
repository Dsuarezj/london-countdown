import { auroraTropics } from "@/backgrounds/aurora-tropics.js";
import { converging } from "@/backgrounds/converging.js";
import { meetingCity } from "@/backgrounds/meeting-city.js";
import { originWeather } from "@/backgrounds/origin-weather.js";
import { loadStylesheet } from "@/utils/stylesheet.js";
import { findActiveThreshold } from "@/utils/thresholds.js";

const BACKGROUNDS = {
  "aurora-tropics": auroraTropics,
  "origin-weather": originWeather,
  converging,
  "meeting-city": meetingCity
};

function seededIndex(seed, length) {
  const noise = Math.sin(seed + 1) * 10000;
  return Math.floor((noise - Math.floor(noise)) * length);
}

export function selectBackgroundId(backgroundsConfig, { remainingMs, isMeetingDay, dayNumber }) {
  if (isMeetingDay && backgroundsConfig.meetingDay) {
    return backgroundsConfig.meetingDay;
  }
  const countdownBackground = findActiveThreshold(backgroundsConfig.countdown, remainingMs);
  if (countdownBackground) {
    return countdownBackground.background;
  }
  if (backgroundsConfig.mode === "random") {
    const { pool, everyDays } = backgroundsConfig.random;
    return pool[seededIndex(Math.floor(dayNumber / everyDays), pool.length)];
  }
  return backgroundsConfig.fixed;
}

export async function mountBackground(skyElement, backgroundId, context) {
  const background = BACKGROUNDS[backgroundId];
  if (background.stylesheet) {
    await loadStylesheet(background.stylesheet);
  }
  skyElement.className = `sky sky--${backgroundId}`;
  skyElement.innerHTML = background.markup;
  background.decorate?.(skyElement, context);
}
