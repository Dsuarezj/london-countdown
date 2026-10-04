import { zonedHour } from "@/utils/meeting-time.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const SKY_CACHE_PREFIX = "place-sky:";
const DAYLIGHT_START_HOUR = 7;
const DAYLIGHT_END_HOUR = 19;

const CONDITIONS_BY_WEATHER_CODE = [
  { condition: "snow", weatherCodes: [71, 73, 75, 77, 85, 86] },
  { condition: "rain", weatherCodes: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99] },
  { condition: "cloudy", weatherCodes: [2, 3, 45, 48] }
];

function conditionFromWeatherCode(weatherCode) {
  const match = CONDITIONS_BY_WEATHER_CODE.find((entry) => entry.weatherCodes.includes(weatherCode));
  return match ? match.condition : "clear";
}

function estimatePhase(timeZone) {
  const localHour = zonedHour(Date.now(), timeZone);
  return localHour >= DAYLIGHT_START_HOUR && localHour < DAYLIGHT_END_HOUR ? "day" : "night";
}

async function requestPlaceSky({ latitude, longitude }) {
  const response = await fetch(`${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current=weather_code,is_day`);
  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}`);
  }
  const { current } = await response.json();
  return {
    phase: current.is_day ? "day" : "night",
    condition: conditionFromWeatherCode(current.weather_code)
  };
}

function skyCacheKey({ latitude, longitude }) {
  return `${SKY_CACHE_PREFIX}${latitude},${longitude}`;
}

export function cachedPlaceSky(place) {
  const cachedSky = localStorage.getItem(skyCacheKey(place));
  return cachedSky ? JSON.parse(cachedSky) : { phase: estimatePhase(place.timeZone), condition: "clear" };
}

export async function fetchPlaceSky(place) {
  try {
    const placeSky = await requestPlaceSky(place);
    localStorage.setItem(skyCacheKey(place), JSON.stringify(placeSky));
    return placeSky;
  } catch (requestError) {
    return { ...cachedPlaceSky(place), phase: estimatePhase(place.timeZone) };
  }
}
