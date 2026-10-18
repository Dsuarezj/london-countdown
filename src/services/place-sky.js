import { requestPlaceSky } from "@/gateways/weather-gateway.js";
import { SkyPhase } from "@/utils/enums.js";
import { zonedHour } from "@/utils/meeting-time.js";

const SKY_CACHE_PREFIX = "place-sky:";
const SKY_CACHE_VERSION = 2;
const DAYLIGHT_START_HOUR = 7;
const DAYLIGHT_END_HOUR = 19;

export const CLEAR_NIGHT_SKY = Object.freeze({
  phase: SkyPhase.NIGHT,
  cloudCoverPct: 0,
  rainMmPerHour: 0,
  snowfallCmPerHour: 0,
  thunder: false
});

function skyCacheKey({ latitude, longitude }) {
  return `${SKY_CACHE_PREFIX}${latitude},${longitude}`;
}

function estimatePlaceSky(timeZone) {
  const localHour = zonedHour(Date.now(), timeZone);
  const isDaylight = localHour >= DAYLIGHT_START_HOUR && localHour < DAYLIGHT_END_HOUR;
  return { ...CLEAR_NIGHT_SKY, phase: isDaylight ? SkyPhase.DAY : SkyPhase.NIGHT, cloudCoverPct: null };
}

export function readStoredPlaceSky(place) {
  const key = skyCacheKey(place);
  const storedSky = localStorage.getItem(key);
  if (!storedSky) {
    return null;
  }
  try {
    const cached = JSON.parse(storedSky);
    const sky = cached?.sky;
    if (cached?.version === SKY_CACHE_VERSION && sky
      && [SkyPhase.DAY, SkyPhase.NIGHT].includes(sky.phase)
      && Number.isFinite(sky.cloudCoverPct) && sky.cloudCoverPct >= 0 && sky.cloudCoverPct <= 100
      && [sky.rainMmPerHour, sky.snowfallCmPerHour].every((value) => Number.isFinite(value) && value >= 0)
      && typeof sky.thunder === "boolean") {
      return sky;
    }
    console.warn("[weather] Discarding an obsolete or invalid sky cache", key);
  } catch (error) {
    console.warn("[weather] Discarding an unreadable sky cache", key, error);
  }
  localStorage.removeItem(key);
  return null;
}

export function samePlaceSky(leftSky, rightSky) {
  return leftSky.phase === rightSky.phase
    && leftSky.cloudCoverPct === rightSky.cloudCoverPct
    && leftSky.rainMmPerHour === rightSky.rainMmPerHour
    && leftSky.snowfallCmPerHour === rightSky.snowfallCmPerHour
    && leftSky.thunder === rightSky.thunder;
}

export async function loadPlaceSky(place) {
  let placeSky;
  try {
    placeSky = await requestPlaceSky(place);
  } catch (error) {
    const storedSky = readStoredPlaceSky(place);
    console.warn(`[weather] Using ${storedSky ? "cached weather" : "a daylight estimate; cloud cover is unknown"}`, place, error);
    return storedSky ?? estimatePlaceSky(place.timeZone);
  }
  try {
    localStorage.setItem(skyCacheKey(place), JSON.stringify({ version: SKY_CACHE_VERSION, sky: placeSky }));
  } catch (error) {
    console.warn("[weather] Unable to cache the latest observation", place, error);
  }
  return placeSky;
}
