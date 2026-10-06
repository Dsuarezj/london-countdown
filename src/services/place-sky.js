import { requestPlaceSky } from "@/gateways/weather-gateway.js";
import { SkyCondition, SkyPhase } from "@/utils/enums.js";
import { zonedHour } from "@/utils/meeting-time.js";

const SKY_CACHE_PREFIX = "place-sky:";
const DAYLIGHT_START_HOUR = 7;
const DAYLIGHT_END_HOUR = 19;

export const CLEAR_NIGHT_SKY = Object.freeze({
  phase: SkyPhase.NIGHT,
  condition: SkyCondition.CLEAR,
  rain: 0,
  snowfall: 0,
  thunder: false
});

function skyCacheKey({ latitude, longitude }) {
  return `${SKY_CACHE_PREFIX}${latitude},${longitude}`;
}

function estimatePlaceSky(timeZone) {
  const localHour = zonedHour(Date.now(), timeZone);
  const isDaylight = localHour >= DAYLIGHT_START_HOUR && localHour < DAYLIGHT_END_HOUR;
  return { ...CLEAR_NIGHT_SKY, phase: isDaylight ? SkyPhase.DAY : SkyPhase.NIGHT };
}

export function readStoredPlaceSky(place) {
  const storedSky = localStorage.getItem(skyCacheKey(place));
  return storedSky ? JSON.parse(storedSky) : null;
}

export function samePlaceSky(leftSky, rightSky) {
  return leftSky.phase === rightSky.phase
    && leftSky.condition === rightSky.condition
    && leftSky.rain === rightSky.rain
    && leftSky.snowfall === rightSky.snowfall
    && leftSky.thunder === rightSky.thunder;
}

export async function loadPlaceSky(place) {
  try {
    const placeSky = await requestPlaceSky(place);
    localStorage.setItem(skyCacheKey(place), JSON.stringify(placeSky));
    return placeSky;
  } catch {
    return readStoredPlaceSky(place) ?? estimatePlaceSky(place.timeZone);
  }
}
