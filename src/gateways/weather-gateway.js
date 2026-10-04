import { SkyCondition, SkyPhase } from "@/utils/enums.js";
import { zonedHour } from "@/utils/meeting-time.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const SKY_CACHE_PREFIX = "place-sky:";
const DAYLIGHT_START_HOUR = 7;
const DAYLIGHT_END_HOUR = 19;

const LIGHT_RAIN_MM = 0.2;
const HEAVY_RAIN_MM = 3;

export const CLEAR_NIGHT_SKY = Object.freeze({
  phase: SkyPhase.NIGHT,
  condition: SkyCondition.CLEAR,
  rain: 0,
  snowfall: 0
});

const CONDITIONS_BY_WEATHER_CODE = [
  { condition: SkyCondition.SNOW, weatherCodes: [71, 73, 75, 77, 85, 86] },
  { condition: SkyCondition.RAIN, weatherCodes: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99] },
  { condition: SkyCondition.OVERCAST, weatherCodes: [3, 45, 48] },
  { condition: SkyCondition.PARTLY, weatherCodes: [2] },
  { condition: SkyCondition.CLEAR, weatherCodes: [0, 1] }
];

function conditionFromWeatherCode(weatherCode) {
  const match = CONDITIONS_BY_WEATHER_CODE.find((entry) => entry.weatherCodes.includes(weatherCode));
  return match ? match.condition : SkyCondition.CLEAR;
}

function estimatePhase(timeZone) {
  const localHour = zonedHour(Date.now(), timeZone);
  return localHour >= DAYLIGHT_START_HOUR && localHour < DAYLIGHT_END_HOUR ? SkyPhase.DAY : SkyPhase.NIGHT;
}

async function requestPlaceSky({ latitude, longitude }) {
  const response = await fetch(`${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current=weather_code,rain,snowfall,is_day`);
  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}`);
  }
  const { current } = await response.json();
  return {
    phase: current.is_day ? SkyPhase.DAY : SkyPhase.NIGHT,
    condition: conditionFromWeatherCode(current.weather_code),
    rain: current.rain,
    snowfall: current.snowfall
  };
}

function rainStrength(rainMm) {
  return Math.min(1, Math.max(0, (rainMm - LIGHT_RAIN_MM) / (HEAVY_RAIN_MM - LIGHT_RAIN_MM)));
}

function skyCacheKey({ latitude, longitude }) {
  return `${SKY_CACHE_PREFIX}${latitude},${longitude}`;
}

function readStoredPlaceSky(place) {
  const cachedSky = localStorage.getItem(skyCacheKey(place));
  if (!cachedSky) {
    return null;
  }
  const parsedSky = JSON.parse(cachedSky);
  return {
    phase: parsedSky.phase,
    condition: parsedSky.condition,
    rain: Number(parsedSky.rain) || 0,
    snowfall: Number(parsedSky.snowfall) || 0
  };
}

function samePlaceSky(leftSky, rightSky) {
  return leftSky.phase === rightSky.phase
    && leftSky.condition === rightSky.condition
    && leftSky.rain === rightSky.rain
    && leftSky.snowfall === rightSky.snowfall;
}

function afterNextPaint(callback) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

export function applyPlaceSky(element, placeSky) {
  element.dataset.phase = placeSky.phase;
  element.dataset.condition = placeSky.condition;
  element.dataset.rain = placeSky.rain;
  element.dataset.snowfall = placeSky.snowfall;
  element.style.setProperty("--rain-strength", String(rainStrength(placeSky.rain)));
}

export async function fetchPlaceSky(place) {
  try {
    const placeSky = await requestPlaceSky(place);
    localStorage.setItem(skyCacheKey(place), JSON.stringify(placeSky));
    return placeSky;
  } catch {
    return readStoredPlaceSky(place) ?? {
      phase: estimatePhase(place.timeZone),
      condition: SkyCondition.CLEAR,
      rain: 0,
      snowfall: 0
    };
  }
}

export async function followPlaceSky(element, place, fadeIn) {
  const storedSky = readStoredPlaceSky(place);
  if (storedSky) {
    applyPlaceSky(element, storedSky);
  }
  const freshSky = await fetchPlaceSky(place);
  if (storedSky && samePlaceSky(storedSky, freshSky)) {
    return;
  }
  if (!storedSky && fadeIn) {
    afterNextPaint(() => applyPlaceSky(element, freshSky));
    return;
  }
  applyPlaceSky(element, freshSky);
}
