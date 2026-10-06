import { AURORA_LAYERS } from "@/backgrounds/aurora-tropics.js";
import { WEATHER_BASE_LAYERS, WEATHER_CLOUD_LAYERS, followWeather } from "@/backgrounds/weather-scene.js";

function hemisphereMarkup(slot) {
  return `
    <div class="weather hemisphere hemisphere--${slot}">
      ${WEATHER_BASE_LAYERS}
      <div class="aurora-field">${AURORA_LAYERS}</div>
      <div class="stars"></div>
      ${WEATHER_CLOUD_LAYERS}
    </div>
  `;
}

export const originWeather = {
  markup: `${hemisphereMarkup("north")}${hemisphereMarkup("south")}`,
  decorate(skyElement, { origins, weatherEnabled, fadeIn }) {
    return Promise.all(Object.entries(origins).map(([slot, origin]) => {
      const hemisphere = skyElement.querySelector(`.hemisphere--${slot}`);
      hemisphere.dataset.nightSky = origin.nightSky;
      return followWeather(hemisphere, origin, { enabled: weatherEnabled, fadeIn });
    }));
  }
};
