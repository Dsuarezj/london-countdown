import { CLEAR_NIGHT_SKY, loadPlaceSky, readStoredPlaceSky, samePlaceSky } from "@/services/place-sky.js";

const LIGHT_RAIN_MM_PER_HOUR = 0.2;
const HEAVY_RAIN_MM_PER_HOUR = 3;
const WEATHER_DEBUG = new URLSearchParams(globalThis.location?.search).has("weatherDebug");

export const WEATHER_BASE_LAYERS = `
  <div class="daylight"></div>
  <div class="cloud-cover"></div>
`;

export const WEATHER_CLOUD_LAYERS = `
  <div class="cloud-veil"></div>
  <div class="thunder"></div>
  <div class="precipitation rain"></div>
  <div class="precipitation snow"></div>
`;

function rainStrength(rainMmPerHour) {
  return Math.min(1, Math.max(0, (rainMmPerHour - LIGHT_RAIN_MM_PER_HOUR) / (HEAVY_RAIN_MM_PER_HOUR - LIGHT_RAIN_MM_PER_HOUR)));
}

function paintPlaceSky(sceneElement, placeSky, place) {
  sceneElement.dataset.phase = placeSky.phase;
  sceneElement.dataset.cloudCoverPct = placeSky.cloudCoverPct ?? "unknown";
  sceneElement.dataset.rainMmPerHour = placeSky.rainMmPerHour;
  sceneElement.dataset.snowfallCmPerHour = placeSky.snowfallCmPerHour;
  sceneElement.dataset.thunder = placeSky.thunder;
  sceneElement.style.setProperty("--cloud-cover", String((placeSky.cloudCoverPct ?? 0) / 100));
  sceneElement.style.setProperty("--rain-strength", String(rainStrength(placeSky.rainMmPerHour)));
  if (WEATHER_DEBUG) {
    afterNextPaint(async () => {
      while (sceneElement.isConnected) {
        const transitions = sceneElement.getAnimations({ subtree: true })
          .filter((animation) => animation instanceof CSSTransition && animation.playState === "running");
        if (!transitions.length) {
          break;
        }
        await Promise.allSettled(transitions.map((transition) => transition.finished));
      }
      if (!sceneElement.isConnected) {
        return;
      }
      const style = (selector) => getComputedStyle(sceneElement.querySelector(selector));
      console.groupCollapsed(`[weather] Painted ${place.latitude},${place.longitude} (after fade)`);
      console.table([
        { variable: "phase", value: sceneElement.dataset.phase, painted: `daylight opacity ${style(".daylight").opacity}` },
        { variable: "cloud cover (%)", value: sceneElement.dataset.cloudCoverPct, painted: `cover ${style(".cloud-cover").opacity}, veil ${style(".cloud-veil").opacity}` },
        { variable: "rain (mm/h)", value: sceneElement.dataset.rainMmPerHour, painted: `opacity ${style(".rain").opacity}, ${style(".rain").animationName}` },
        { variable: "snowfall (cm/h)", value: sceneElement.dataset.snowfallCmPerHour, painted: `opacity ${style(".snow").opacity}, ${style(".snow").animationName}` },
        { variable: "thunder", value: sceneElement.dataset.thunder, painted: `opacity ${style(".thunder").opacity}, flashes ${getComputedStyle(sceneElement.querySelector(".thunder"), "::before").animationName}` }
      ]);
      console.groupEnd();
    });
  }
}

function afterNextPaint(callback) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

export async function followWeather(sceneElement, place, { enabled, fadeIn }) {
  if (!enabled) {
    paintPlaceSky(sceneElement, CLEAR_NIGHT_SKY, place);
    return;
  }
  const storedSky = readStoredPlaceSky(place);
  if (storedSky) {
    paintPlaceSky(sceneElement, storedSky, place);
  }
  const freshSky = await loadPlaceSky(place);
  if (storedSky && samePlaceSky(storedSky, freshSky)) {
    return;
  }
  if (!storedSky && fadeIn) {
    afterNextPaint(() => paintPlaceSky(sceneElement, freshSky, place));
    return;
  }
  paintPlaceSky(sceneElement, freshSky, place);
}
