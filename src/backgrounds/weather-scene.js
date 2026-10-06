import { CLEAR_NIGHT_SKY, loadPlaceSky, readStoredPlaceSky, samePlaceSky } from "@/services/place-sky.js";

const LIGHT_RAIN_MM = 0.2;
const HEAVY_RAIN_MM = 3;

export const WEATHER_BASE_LAYERS = `
  <div class="daylight"></div>
  <div class="overcast"></div>
`;

export const WEATHER_CLOUD_LAYERS = `
  <div class="veil"></div>
  <div class="thunder"></div>
  <div class="precipitation"></div>
`;

function rainStrength(rainMm) {
  return Math.min(1, Math.max(0, (rainMm - LIGHT_RAIN_MM) / (HEAVY_RAIN_MM - LIGHT_RAIN_MM)));
}

function paintPlaceSky(sceneElement, placeSky) {
  sceneElement.dataset.phase = placeSky.phase;
  sceneElement.dataset.condition = placeSky.condition;
  sceneElement.dataset.rain = placeSky.rain;
  sceneElement.dataset.snowfall = placeSky.snowfall;
  sceneElement.dataset.thunder = placeSky.thunder;
  sceneElement.style.setProperty("--rain-strength", String(rainStrength(placeSky.rain)));
}

function afterNextPaint(callback) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

export async function followWeather(sceneElement, place, { enabled, fadeIn }) {
  if (!enabled) {
    paintPlaceSky(sceneElement, CLEAR_NIGHT_SKY);
    return;
  }
  const storedSky = readStoredPlaceSky(place);
  if (storedSky) {
    paintPlaceSky(sceneElement, storedSky);
  }
  const freshSky = await loadPlaceSky(place);
  if (storedSky && samePlaceSky(storedSky, freshSky)) {
    return;
  }
  if (!storedSky && fadeIn) {
    afterNextPaint(() => paintPlaceSky(sceneElement, freshSky));
    return;
  }
  paintPlaceSky(sceneElement, freshSky);
}
