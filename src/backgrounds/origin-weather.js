import { createAuroraLayers } from "@/backgrounds/aurora-tropics.js";
import { WEATHER_BASE_LAYERS, WEATHER_CLOUD_LAYERS, followWeather } from "@/backgrounds/weather-scene.js";

const AUTUMN_CONSTELLATIONS = `
  <svg class="constellation constellation--cassiopeia" viewBox="0 0 240 160" aria-hidden="true" focusable="false">
    <circle data-star="caph" cx="26" cy="58" r="1.9"/>
    <circle data-star="schedar" cx="64" cy="108" r="2"/>
    <circle data-star="navi" cx="107" cy="64" r="2.1"/>
    <circle data-star="ruchbah" cx="151" cy="86" r="1.6"/>
    <circle data-star="segin" cx="214" cy="58" r="1.2" opacity=".75"/>
  </svg>
  <svg class="constellation constellation--cygnus" viewBox="0 0 240 190" aria-hidden="true" focusable="false">
    <circle data-star="deneb" cx="125" cy="24" r="2.4"/>
    <circle data-star="sadr" cx="125" cy="65" r="1.9"/>
    <circle data-star="albireo" cx="119" cy="169" r="1.3" fill="#f2d7b2"/>
    <circle data-star="delta-cygni" cx="71" cy="60" r="1.4"/>
    <circle data-star="gienah" cx="172" cy="88" r="1.6"/>
  </svg>
`;

function hemisphereMarkup(slot) {
  return `
    <div class="weather hemisphere hemisphere--${slot}">
      ${WEATHER_BASE_LAYERS}
      <div class="aurora-field">${createAuroraLayers(`aurora-${slot}`)}</div>
      <div class="stars">${slot === "south" ? AUTUMN_CONSTELLATIONS : ""}</div>
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
